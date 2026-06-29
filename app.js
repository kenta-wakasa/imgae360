import * as THREE from "three";

const scannerView = document.querySelector("#scannerView");
const viewerView = document.querySelector("#viewerView");
const cameraPreview = document.querySelector("#cameraPreview");
const qrCanvas = document.querySelector("#qrCanvas");
const scannerMessage = document.querySelector("#scannerMessage");
const startScanButton = document.querySelector("#startScanButton");
const sampleButton = document.querySelector("#sampleButton");
const backToScanButton = document.querySelector("#backToScanButton");
const motionButton = document.querySelector("#motionButton");
const viewerMessage = document.querySelector("#viewerMessage");
const imageName = document.querySelector("#imageName");
const panorama = document.querySelector("#panorama");

const IMAGE_BASE_PATH = "./";
const DEFAULT_IMAGE = "01.jpg";
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

startScanButton.addEventListener("click", startScanner);
sampleButton.addEventListener("click", () => openImage(DEFAULT_IMAGE));
backToScanButton.addEventListener("click", showScanner);
motionButton.addEventListener("click", enableMotion);
window.addEventListener("resize", resizeRenderer);
window.addEventListener("orientationchange", resizeRenderer);

startScanner();

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
    const fileName = normalizeImageName(result.data);
    scannerMessage.textContent = `${fileName} を読み込みます...`;
    openImage(fileName);
    return;
  }

  scanFrameId = requestAnimationFrame(scanQrCode);
}

function normalizeImageName(value) {
  const cleanValue = value.trim().split(/[?#]/)[0].split("/").pop() || DEFAULT_IMAGE;
  if (/\.(jpg|jpeg|png|webp)$/i.test(cleanValue)) {
    return cleanValue;
  }
  return `${cleanValue}.jpg`;
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
  showView(scannerView);
  startScanner();
}

async function openImage(fileName) {
  stopScanner();
  showView(viewerView);
  imageName.textContent = fileName;
  viewerMessage.textContent = "360度画像を読み込んでいます...";

  initViewer();
  await loadPanorama(`${IMAGE_BASE_PATH}${encodeURIComponent(fileName)}`);
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

async function loadPanorama(imageUrl) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");

  try {
    const texture = await textureLoader.loadAsync(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    sphere.material.map = texture;
    sphere.material.color.set(0xffffff);
    sphere.material.needsUpdate = true;
    viewerMessage.textContent = "スマホを動かすか、画面をドラッグして視点を動かせます。";
  } catch (error) {
    sphere.material.map = null;
    sphere.material.color.set(0x1f2937);
    sphere.material.needsUpdate = true;
    viewerMessage.textContent = "画像を読み込めませんでした。QRコードの画像名を確認してください。";
  }
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
