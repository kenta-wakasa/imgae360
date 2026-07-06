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

const initialMediaName = getMediaNameFromCurrentUrl();
if (initialMediaName) {
  openMedia(initialMediaName);
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
    const fileName = resolveMediaName(result.data);
    scannerMessage.textContent = `${fileName} を読み込みます...`;
    openMedia(fileName);
    return;
  }

  scanFrameId = requestAnimationFrame(scanQrCode);
}

function getMediaNameFromCurrentUrl() {
  const params = new URLSearchParams(window.location.search);
  const videoValue = params.get("video");
  if (videoValue) {
    return normalizeMediaName(videoValue, "mp4");
  }

  const value = params.get("media") || params.get("image") || params.get("img") || params.get("file");
  if (value) {
    return normalizeMediaName(value, "jpg");
  }

  const hashValue = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hashValue) {
    return normalizeMediaName(hashValue, "jpg");
  }

  return "";
}

function resolveMediaName(value) {
  const text = value.trim();
  try {
    const url = new URL(text, window.location.href);
    const paramValue =
      url.searchParams.get("media") ||
      url.searchParams.get("video") ||
      url.searchParams.get("image") ||
      url.searchParams.get("img") ||
      url.searchParams.get("file");
    if (paramValue) {
      return normalizeMediaName(paramValue, url.searchParams.has("video") ? "mp4" : "jpg");
    }
  } catch (error) {
    // Fall back to treating the QR value as a plain media name.
  }

  return normalizeMediaName(text, "jpg");
}

function normalizeMediaName(value, defaultExtension) {
  const cleanValue = value.trim().split(/[?#]/)[0].split("/").pop() || DEFAULT_MEDIA;
  if (/\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i.test(cleanValue)) {
    return cleanValue;
  }
  return `${cleanValue}.${defaultExtension}`;
}

function getMediaType(fileName) {
  return /\.(mp4|webm|mov)$/i.test(fileName) ? "video" : "image";
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

async function openMedia(fileName) {
  stopScanner();
  showView(viewerView);
  imageName.textContent = fileName;
  activeMediaType = getMediaType(fileName);
  viewerMessage.textContent = `360度${activeMediaType === "video" ? "動画" : "画像"}を読み込んでいます...`;

  initViewer();
  await loadPanorama(`${MEDIA_BASE_PATH}${encodeURIComponent(fileName)}`, activeMediaType);
  resizeRenderer();
  startViewerLoop();
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
    viewerMessage.textContent = "メディアを読み込めませんでした。QRコードのファイル名を確認してください。";
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
