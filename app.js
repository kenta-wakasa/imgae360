import * as THREE from "three";

const scannerView = document.querySelector("#scannerView");
const viewerView = document.querySelector("#viewerView");
const cameraPreview = document.querySelector("#cameraPreview");
const qrCanvas = document.querySelector("#qrCanvas");
const scannerMessage = document.querySelector("#scannerMessage");
const startScanButton = document.querySelector("#startScanButton");
const sampleButton = document.querySelector("#sampleButton");
const sampleVideoButton = document.querySelector("#sampleVideoButton");
const backToScanButton = document.querySelector("#backToScanButton");
const motionButton = document.querySelector("#motionButton");
const videoControls = document.querySelector("#videoControls");
const videoPlayButton = document.querySelector("#videoPlayButton");
const videoSeekBar = document.querySelector("#videoSeekBar");
const videoCurrentTime = document.querySelector("#videoCurrentTime");
const videoDuration = document.querySelector("#videoDuration");
const videoMuteButton = document.querySelector("#videoMuteButton");
const viewerMessage = document.querySelector("#viewerMessage");
const imageName = document.querySelector("#imageName");
const panorama = document.querySelector("#panorama");
const youtubeFrame = document.querySelector("#youtubeFrame");

const MEDIA_BASE_PATH = "./";
const DEFAULT_MEDIA = "01.jpg";
const DEFAULT_VIDEO = "sample.mp4";
const qrContext = qrCanvas.getContext("2d", { willReadFrequently: true });

let scanStream = null;
let scanFrameId = 0;
let renderer;
let scene;
let camera;
let sphere;
let animationFrameId = 0;
let dragState = null;
let yaw = 0;
let pitch = 0;
let motionEnabled = false;
let latestOrientation = null;
let activeTexture = null;
let activeVideo = null;
let activeMediaType = "image";

startScanButton.addEventListener("click", startScanner);
sampleButton.addEventListener("click", () => openMedia(DEFAULT_MEDIA));
sampleVideoButton.addEventListener("click", () => openMedia(DEFAULT_VIDEO));
backToScanButton.addEventListener("click", showScanner);
motionButton.addEventListener("click", enableMotion);
videoPlayButton.addEventListener("click", toggleVideoPlayback);
videoMuteButton.addEventListener("click", toggleVideoMute);
videoSeekBar.addEventListener("input", seekActiveVideo);
window.addEventListener("resize", resizeRenderer);
window.addEventListener("orientationchange", resizeRenderer);

const initialMedia = getMediaFromCurrentUrl();
if (initialMedia) {
  openMedia(initialMedia);
} else {
  startScanner();
}

async function startScanner() {
  showView(scannerView);
  stopScanner();
  scannerMessage.textContent = "カメラへのアクセスを確認しています...";

  if (!navigator.mediaDevices?.getUserMedia) {
    scannerMessage.textContent = "このブラウザではカメラ読み取りに対応していません。";
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    cameraPreview.srcObject = scanStream;
    await cameraPreview.play();
    scannerMessage.textContent = "QRコードを枠内に合わせてください。";
    scanFrameId = requestAnimationFrame(scanQrCode);
  } catch (error) {
    scannerMessage.textContent = "カメラを起動できませんでした。権限を確認してください。";
  }
}

function scanQrCode() {
  if (!scanStream || cameraPreview.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    scanFrameId = requestAnimationFrame(scanQrCode);
    return;
  }

  qrCanvas.width = cameraPreview.videoWidth;
  qrCanvas.height = cameraPreview.videoHeight;
  qrContext.drawImage(cameraPreview, 0, 0, qrCanvas.width, qrCanvas.height);

  const frame = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
  const result = window.jsQR?.(frame.data, frame.width, frame.height, {
    inversionAttempts: "dontInvert"
  });

  if (result?.data) {
    const media = resolveMedia(result.data);
    scannerMessage.textContent = `${getMediaLabel(media.source)} を読み込みます...`;
    openMedia(media);
    return;
  }

  scanFrameId = requestAnimationFrame(scanQrCode);
}

function getMediaFromCurrentUrl() {
  const params = new URLSearchParams(window.location.search);
  const youtubeValue = params.get("youtube") || params.get("yt");
  if (youtubeValue) {
    return createMediaDescriptor(youtubeValue, "", "youtube");
  }

  const videoValue = params.get("video");
  if (videoValue) {
    return createMediaDescriptor(videoValue, "mp4", "video");
  }

  const value = params.get("media") || params.get("image") || params.get("img") || params.get("file");
  if (value) {
    return createMediaDescriptor(value, "jpg", normalizeMediaType(params.get("type")));
  }

  const hashValue = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hashValue) {
    return createMediaDescriptor(hashValue, "jpg", "");
  }

  return null;
}

function resolveMedia(value) {
  const text = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
    return createMediaDescriptor(text, "", "youtube");
  }

  try {
    const url = new URL(text, window.location.href);
    if (isYouTubeUrl(url)) {
      return createMediaDescriptor(text, "", "youtube");
    }

    const paramValue =
      url.searchParams.get("youtube") ||
      url.searchParams.get("yt") ||
      url.searchParams.get("media") ||
      url.searchParams.get("video") ||
      url.searchParams.get("image") ||
      url.searchParams.get("img") ||
      url.searchParams.get("file");
    if (paramValue) {
      const hasYouTubeParam = url.searchParams.has("youtube") || url.searchParams.has("yt");
      return createMediaDescriptor(
        paramValue,
        url.searchParams.has("video") ? "mp4" : "jpg",
        hasYouTubeParam ? "youtube" : url.searchParams.has("video") ? "video" : normalizeMediaType(url.searchParams.get("type"))
      );
    }

    if (/^https?:$/i.test(url.protocol)) {
      return createMediaDescriptor(text, "jpg", normalizeMediaType(url.searchParams.get("type")));
    }
  } catch (error) {
    // Fall back to treating the QR value as a plain media name.
  }

  return createMediaDescriptor(text, "jpg", "");
}

function createMediaDescriptor(value, defaultExtension, typeHint) {
  if (typeHint === "youtube") {
    const videoId = getYouTubeVideoId(value);
    return {
      source: videoId || value.trim(),
      type: "youtube"
    };
  }

  const source = normalizeMediaSource(value, defaultExtension);
  return {
    source,
    type: typeHint || getMediaType(source)
  };
}

function normalizeMediaSource(value, defaultExtension) {
  const trimmedValue = value.trim();
  if (isExternalUrl(trimmedValue)) {
    return trimmedValue;
  }

  const cleanValue = trimmedValue.split(/[?#]/)[0].split("/").pop() || DEFAULT_MEDIA;
  if (/\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i.test(cleanValue)) {
    return cleanValue;
  }
  return `${cleanValue}.${defaultExtension}`;
}

function getMediaType(mediaSource) {
  if (getYouTubeVideoId(mediaSource)) {
    return "youtube";
  }

  const path = getMediaPath(mediaSource);
  return /\.(mp4|webm|mov)$/i.test(path) ? "video" : "image";
}

function normalizeMediaType(type) {
  return /^(image|video|youtube)$/i.test(type || "") ? type.toLowerCase() : "";
}

function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/i.test(url.protocol);
  } catch (error) {
    return false;
  }
}

function getMediaPath(mediaSource) {
  try {
    return new URL(mediaSource).pathname;
  } catch (error) {
    return mediaSource;
  }
}

function getMediaUrl(mediaSource) {
  if (isExternalUrl(mediaSource)) {
    return mediaSource;
  }
  return `${MEDIA_BASE_PATH}${encodeURIComponent(mediaSource)}`;
}

function getMediaLabel(mediaSource) {
  if (getYouTubeVideoId(mediaSource) || /^[a-zA-Z0-9_-]{11}$/.test(mediaSource)) {
    return `YouTube: ${getYouTubeVideoId(mediaSource) || mediaSource}`;
  }

  try {
    const url = new URL(mediaSource);
    return decodeURIComponent(url.pathname.split("/").pop() || url.hostname);
  } catch (error) {
    return mediaSource;
  }
}

function getYouTubeVideoId(value) {
  const text = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
    return text;
  }

  try {
    const url = new URL(text);
    if (!isYouTubeUrl(url)) {
      return "";
    }

    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      return url.pathname.split("/").filter(Boolean)[1] || "";
    }

    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/").filter(Boolean)[1] || "";
    }

    return url.searchParams.get("v") || "";
  } catch (error) {
    return "";
  }
}

function isYouTubeUrl(url) {
  const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
  return hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtu.be";
}

function stopScanner() {
  cancelAnimationFrame(scanFrameId);
  scanFrameId = 0;
  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }
  cameraPreview.srcObject = null;
}

function showScanner() {
  stopViewerLoop();
  stopActiveVideo();
  showView(scannerView);
  startScanner();
}

async function openMedia(mediaInput) {
  const media = typeof mediaInput === "string" ? createMediaDescriptor(mediaInput, "jpg", "") : mediaInput;
  stopScanner();
  showView(viewerView);
  imageName.textContent = getMediaLabel(media.source);
  activeMediaType = media.type;
  viewerMessage.textContent = `360度${activeMediaType === "image" ? "画像" : "動画"}を読み込んでいます...`;

  if (activeMediaType === "youtube") {
    showYouTubePlayer(media.source);
    return;
  }

  initViewer();
  await loadPanorama(getMediaUrl(media.source), activeMediaType);
  resizeRenderer();
  startViewerLoop();
}

function showYouTubePlayer(videoId) {
  clearActiveMedia();
  stopViewerLoop();
  setVideoControlsVisible(false);
  viewerView.classList.add("youtube-active");
  panorama.classList.add("hidden");
  youtubeFrame.classList.remove("hidden");
  youtubeFrame.innerHTML = "";

  const iframe = document.createElement("iframe");
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  const params = new URLSearchParams({
    playsinline: "1",
    controls: "1",
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    origin: window.location.origin
  });
  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  iframe.title = "YouTube 360度動画プレイヤー";
  youtubeFrame.appendChild(iframe);

  viewerMessage.textContent = "YouTubeプレイヤー内をドラッグして視点を動かせます。スマホでは全画面表示にするとジャイロ操作しやすくなります。";
}

function initViewer() {
  if (renderer) {
    return;
  }

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  panorama.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(500, 80, 50);
  geometry.scale(-1, 1, 1);
  sphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x111827 }));
  scene.add(sphere);

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerup", clearDragState);
  renderer.domElement.addEventListener("pointercancel", clearDragState);
}

async function loadPanorama(mediaUrl, mediaType) {
  clearActiveMedia();
  youtubeFrame.classList.add("hidden");
  youtubeFrame.innerHTML = "";
  panorama.classList.remove("hidden");

  try {
    const texture = mediaType === "video" ? await createVideoTexture(mediaUrl) : await createImageTexture(mediaUrl);
    activeTexture = texture;
    sphere.material.color.set(0xffffff);
    sphere.material.map = texture;
    sphere.material.needsUpdate = true;
    setVideoControlsVisible(mediaType === "video");
    viewerMessage.textContent =
      mediaType === "video"
        ? "動画を再生しながら、スマホを動かすか画面をドラッグして視点を動かせます。"
        : "スマホを動かすか、画面をドラッグして視点を動かせます。";
  } catch (error) {
    sphere.material.map = null;
    sphere.material.color.set(0x1f2937);
    sphere.material.needsUpdate = true;
    setVideoControlsVisible(false);
    viewerMessage.textContent = "メディアを読み込めませんでした。URL、ファイル形式、CORS設定を確認してください。";
  }
}

async function createImageTexture(imageUrl) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");
  const texture = await textureLoader.loadAsync(imageUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function createVideoTexture(videoUrl) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  activeVideo = video;
  bindVideoEvents(video);
  await waitForVideoReady(video);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  await playActiveVideo();
  return texture;
}

function waitForVideoReady(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video failed to load"));
    };

    video.addEventListener("loadeddata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.load();
  });
}

async function playActiveVideo() {
  if (!activeVideo) {
    return;
  }

  try {
    await activeVideo.play();
    updateVideoControls();
  } catch (error) {
    updateVideoControls();
    viewerMessage.textContent = "動画の再生には画面上の再生ボタンを押してください。";
  }
}

async function toggleVideoPlayback() {
  if (!activeVideo) {
    return;
  }

  if (activeVideo.paused) {
    await playActiveVideo();
  } else {
    activeVideo.pause();
    updateVideoControls();
    viewerMessage.textContent = "動画を一時停止しました。";
  }
}

function toggleVideoMute() {
  if (!activeVideo) {
    return;
  }
  activeVideo.muted = !activeVideo.muted;
  updateVideoControls();
}

function seekActiveVideo() {
  if (!activeVideo || !Number.isFinite(activeVideo.duration) || activeVideo.duration <= 0) {
    return;
  }
  activeVideo.currentTime = (Number(videoSeekBar.value) / Number(videoSeekBar.max)) * activeVideo.duration;
  updateVideoControls();
}

function bindVideoEvents(video) {
  video.addEventListener("play", updateVideoControls);
  video.addEventListener("pause", updateVideoControls);
  video.addEventListener("timeupdate", updateVideoControls);
  video.addEventListener("loadedmetadata", updateVideoControls);
  video.addEventListener("durationchange", updateVideoControls);
  video.addEventListener("volumechange", updateVideoControls);
}

function updateVideoControls() {
  if (!activeVideo) {
    videoPlayButton.setAttribute("aria-label", "再生");
    videoPlayButton.querySelector("span").textContent = "▶";
    videoMuteButton.setAttribute("aria-label", "ミュート解除");
    videoMuteButton.querySelector("span").textContent = "🔇";
    videoSeekBar.value = "0";
    videoCurrentTime.textContent = "0:00";
    videoDuration.textContent = "0:00";
    return;
  }

  const isPaused = activeVideo.paused;
  videoPlayButton.setAttribute("aria-label", isPaused ? "再生" : "一時停止");
  videoPlayButton.querySelector("span").textContent = isPaused ? "▶" : "Ⅱ";

  const isMuted = activeVideo.muted || activeVideo.volume === 0;
  videoMuteButton.setAttribute("aria-label", isMuted ? "ミュート解除" : "ミュート");
  videoMuteButton.querySelector("span").textContent = isMuted ? "🔇" : "🔊";

  const duration = Number.isFinite(activeVideo.duration) ? activeVideo.duration : 0;
  const currentTime = Number.isFinite(activeVideo.currentTime) ? activeVideo.currentTime : 0;
  videoCurrentTime.textContent = formatTime(currentTime);
  videoDuration.textContent = formatTime(duration);
  videoSeekBar.value = duration > 0 ? String(Math.round((currentTime / duration) * Number(videoSeekBar.max))) : "0";
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setVideoControlsVisible(isVisible) {
  videoControls.classList.toggle("hidden", !isVisible);
  viewerView.classList.toggle("video-active", isVisible);
  if (!isVisible) {
    updateVideoControls();
  }
}

function clearActiveMedia() {
  viewerView.classList.remove("youtube-active");
  youtubeFrame.classList.add("hidden");
  youtubeFrame.innerHTML = "";
  panorama.classList.remove("hidden");
  stopActiveVideo();
  if (activeTexture) {
    activeTexture.dispose();
    activeTexture = null;
  }
}

function stopActiveVideo() {
  if (!activeVideo) {
    return;
  }
  activeVideo.pause();
  activeVideo.removeAttribute("src");
  activeVideo.load();
  activeVideo = null;
  setVideoControlsVisible(false);
}

async function enableMotion() {
  if (motionEnabled) {
    motionEnabled = false;
    latestOrientation = null;
    window.removeEventListener("deviceorientation", handleOrientation);
    motionButton.classList.remove("is-active");
    motionButton.textContent = "ジャイロON";
    viewerMessage.textContent = "ジャイロをOFFにしました。画面ドラッグで視点を動かせます。";
    return;
  }

  try {
    if (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof window.DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        viewerMessage.textContent = "ジャイロの利用が許可されませんでした。";
        return;
      }
    }

    motionEnabled = true;
    window.addEventListener("deviceorientation", handleOrientation, true);
    motionButton.classList.add("is-active");
    motionButton.textContent = "ジャイロON中";
    viewerMessage.textContent = "スマホ本体を動かして360度画像を見回せます。";
  } catch (error) {
    viewerMessage.textContent = "この端末ではジャイロを有効にできませんでした。";
  }
}

function handleOrientation(event) {
  latestOrientation = {
    alpha: THREE.MathUtils.degToRad(event.alpha || 0),
    beta: THREE.MathUtils.degToRad(event.beta || 0),
    gamma: THREE.MathUtils.degToRad(event.gamma || 0),
    orient: THREE.MathUtils.degToRad(window.orientation || 0)
  };
}

function startViewerLoop() {
  cancelAnimationFrame(animationFrameId);
  const renderFrame = () => {
    if (motionEnabled && latestOrientation) {
      applyDeviceOrientation(latestOrientation);
    } else {
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      camera.rotation.z = 0;
    }

    renderer.render(scene, camera);
    animationFrameId = requestAnimationFrame(renderFrame);
  };
  renderFrame();
}

function stopViewerLoop() {
  cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
}

function applyDeviceOrientation({ alpha, beta, gamma, orient }) {
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const zee = new THREE.Vector3(0, 0, 1);
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const q0 = new THREE.Quaternion();

  euler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(euler);
  quaternion.multiply(q1);
  quaternion.multiply(q0.setFromAxisAngle(zee, -orient));
  camera.quaternion.copy(quaternion);
}

function handlePointerDown(event) {
  dragState = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    yaw,
    pitch
  };
  renderer.domElement.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = event.clientX - dragState.x;
  const deltaY = event.clientY - dragState.y;
  yaw = dragState.yaw - deltaX * 0.005;
  pitch = THREE.MathUtils.clamp(dragState.pitch - deltaY * 0.005, -1.35, 1.35);
}

function clearDragState() {
  dragState = null;
}

function resizeRenderer() {
  if (!renderer) {
    return;
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function showView(activeView) {
  scannerView.classList.toggle("view-active", activeView === scannerView);
  viewerView.classList.toggle("view-active", activeView === viewerView);
}
