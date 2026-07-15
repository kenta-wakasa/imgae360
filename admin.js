import QRCode from "https://esm.run/qrcode@1.5.3";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getStorage,
  ref,
  listAll,
  getMetadata,
  getDownloadURL,
  uploadBytesResumable,
  updateMetadata,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBaYjptMCa9dMWbRog5mn5C-8qgTLwAev0",
  authDomain: "animal-onomatope.firebaseapp.com",
  projectId: "animal-onomatope",
  storageBucket: "animal-onomatope.appspot.com",
  messagingSenderId: "1047896995916",
  appId: "1:1047896995916:web:824042a757ff5ef06fdce9"
};

const MEDIA_FOLDER = "image360";

const listView = document.querySelector("#listView");
const detailView = document.querySelector("#detailView");
const uploadForm = document.querySelector("#uploadForm");
const uploadTitle = document.querySelector("#uploadTitle");
const uploadFile = document.querySelector("#uploadFile");
const uploadButton = document.querySelector("#uploadButton");
const uploadProgress = document.querySelector("#uploadProgress");
const uploadProgressBar = document.querySelector("#uploadProgressBar");
const uploadMessage = document.querySelector("#uploadMessage");
const reloadButton = document.querySelector("#reloadButton");
const listMessage = document.querySelector("#listMessage");
const mediaList = document.querySelector("#mediaList");
const backToListButton = document.querySelector("#backToListButton");
const detailTitle = document.querySelector("#detailTitle");
const detailPreview = document.querySelector("#detailPreview");
const detailMeta = document.querySelector("#detailMeta");
const titleForm = document.querySelector("#titleForm");
const titleInput = document.querySelector("#titleInput");
const viewerUrlBox = document.querySelector("#viewerUrl");
const copyUrlButton = document.querySelector("#copyUrlButton");
const openViewerLink = document.querySelector("#openViewerLink");
const qrCodeCanvas = document.querySelector("#qrCodeCanvas");
const downloadQrButton = document.querySelector("#downloadQrButton");
const deleteButton = document.querySelector("#deleteButton");
const detailMessage = document.querySelector("#detailMessage");

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

let activeItem = null;

uploadForm.addEventListener("submit", handleUpload);
reloadButton.addEventListener("click", () => loadMediaList());
backToListButton.addEventListener("click", showListView);
titleForm.addEventListener("submit", handleTitleSave);
copyUrlButton.addEventListener("click", copyViewerUrl);
downloadQrButton.addEventListener("click", downloadQrImage);
deleteButton.addEventListener("click", handleDelete);

loadMediaList();

async function loadMediaList() {
  listMessage.textContent = "読み込んでいます...";
  mediaList.innerHTML = "";

  try {
    const folderRef = ref(storage, MEDIA_FOLDER);
    const result = await listAll(folderRef);
    const items = await Promise.all(result.items.map(loadMediaItem));
    items.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

    if (items.length === 0) {
      listMessage.textContent = "まだメディアがありません。上のフォームからアップロードしてください。";
      return;
    }

    listMessage.textContent = `${items.length}件のメディア`;
    for (const item of items) {
      mediaList.appendChild(createMediaListEntry(item));
    }
  } catch (error) {
    listMessage.textContent = describeStorageError(error, "一覧を読み込めませんでした");
  }
}

async function loadMediaItem(itemRef) {
  const [metadata, downloadUrl] = await Promise.all([getMetadata(itemRef), getDownloadURL(itemRef)]);
  return {
    ref: itemRef,
    name: itemRef.name,
    title: metadata.customMetadata?.title || itemRef.name,
    contentType: metadata.contentType || "",
    mediaType: (metadata.contentType || "").startsWith("video/") ? "video" : "image",
    size: metadata.size,
    timeCreated: metadata.timeCreated,
    downloadUrl
  };
}

function createMediaListEntry(item) {
  const entry = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "media-list-item";
  button.addEventListener("click", () => showDetailView(item));

  const thumb = document.createElement("div");
  thumb.className = "media-thumb";
  if (item.mediaType === "image") {
    const img = document.createElement("img");
    img.src = item.downloadUrl;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    thumb.textContent = "🎬";
  }

  const info = document.createElement("div");
  info.className = "media-info";
  const title = document.createElement("p");
  title.className = "media-title";
  title.textContent = item.title;
  const meta = document.createElement("p");
  meta.className = "media-sub";
  meta.textContent = `${item.mediaType === "video" ? "動画" : "画像"} ・ ${formatSize(item.size)} ・ ${formatDate(item.timeCreated)}`;
  info.append(title, meta);

  const chevron = document.createElement("span");
  chevron.className = "media-chevron";
  chevron.textContent = "›";

  button.append(thumb, info, chevron);
  entry.appendChild(button);
  return entry;
}

async function handleUpload(event) {
  event.preventDefault();
  const file = uploadFile.files?.[0];
  const title = uploadTitle.value.trim();
  if (!file || !title) {
    return;
  }

  uploadButton.disabled = true;
  uploadProgress.classList.remove("hidden");
  uploadProgressBar.style.width = "0%";
  uploadMessage.textContent = "アップロードしています...";

  const extension = getFileExtension(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  const fileRef = ref(storage, `${MEDIA_FOLDER}/${fileName}`);

  try {
    const task = uploadBytesResumable(fileRef, file, {
      contentType: file.type,
      customMetadata: { title }
    });

    await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          uploadProgressBar.style.width = `${percent}%`;
          uploadMessage.textContent = `アップロードしています... ${percent}%`;
        },
        reject,
        resolve
      );
    });

    const item = await loadMediaItem(fileRef);
    uploadForm.reset();
    uploadMessage.textContent = "";
    loadMediaList();
    showDetailView(item);
  } catch (error) {
    uploadMessage.textContent = describeStorageError(error, "アップロードに失敗しました");
  } finally {
    uploadButton.disabled = false;
    uploadProgress.classList.add("hidden");
  }
}

function showListView() {
  activeItem = null;
  listView.classList.add("view-active");
  detailView.classList.remove("view-active");
  detailMessage.textContent = "";
  window.scrollTo(0, 0);
}

function showDetailView(item) {
  activeItem = item;
  listView.classList.remove("view-active");
  detailView.classList.add("view-active");
  detailMessage.textContent = "";
  window.scrollTo(0, 0);

  detailTitle.textContent = item.title;
  titleInput.value = item.title;

  detailPreview.innerHTML = "";
  if (item.mediaType === "image") {
    const img = document.createElement("img");
    img.src = item.downloadUrl;
    img.alt = item.title;
    detailPreview.appendChild(img);
  } else {
    const video = document.createElement("video");
    video.src = item.downloadUrl;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    detailPreview.appendChild(video);
  }

  detailMeta.innerHTML = "";
  appendMetaRow("種別", item.mediaType === "video" ? "360度動画" : "360度画像");
  appendMetaRow("ファイル名", item.name);
  appendMetaRow("サイズ", formatSize(item.size));
  appendMetaRow("アップロード日時", formatDate(item.timeCreated));

  const viewerUrl = buildViewerUrl(item);
  viewerUrlBox.textContent = viewerUrl;
  openViewerLink.href = viewerUrl;
  renderQrCode(viewerUrl);
}

function appendMetaRow(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  detailMeta.append(dt, dd);
}

function buildViewerUrl(item) {
  const viewerBase = new URL("./", window.location.href);
  return `${viewerBase.href}?media=${encodeURIComponent(item.downloadUrl)}&type=${item.mediaType}`;
}

function renderQrCode(text) {
  QRCode.toCanvas(qrCodeCanvas, text, { width: 320, margin: 2 }, (error) => {
    if (error) {
      detailMessage.textContent = "QRコードを生成できませんでした。";
    }
  });
}

async function handleTitleSave(event) {
  event.preventDefault();
  if (!activeItem) {
    return;
  }

  const title = titleInput.value.trim();
  if (!title) {
    return;
  }

  try {
    await updateMetadata(activeItem.ref, { customMetadata: { title } });
    activeItem.title = title;
    detailTitle.textContent = title;
    detailMessage.textContent = "タイトルを保存しました。";
    loadMediaList();
  } catch (error) {
    detailMessage.textContent = describeStorageError(error, "タイトルを保存できませんでした");
  }
}

async function copyViewerUrl() {
  if (!activeItem) {
    return;
  }

  try {
    await navigator.clipboard.writeText(buildViewerUrl(activeItem));
    detailMessage.textContent = "URLをコピーしました。";
  } catch (error) {
    detailMessage.textContent = "コピーできませんでした。URLを選択して手動でコピーしてください。";
  }
}

function downloadQrImage() {
  if (!activeItem) {
    return;
  }

  const link = document.createElement("a");
  link.href = qrCodeCanvas.toDataURL("image/png");
  link.download = `qr-${activeItem.name.replace(/\.[^.]+$/, "")}.png`;
  link.click();
}

async function handleDelete() {
  if (!activeItem) {
    return;
  }

  const confirmed = window.confirm(`「${activeItem.title}」を削除しますか?\nこの操作は取り消せません。`);
  if (!confirmed) {
    return;
  }

  try {
    await deleteObject(activeItem.ref);
    showListView();
    loadMediaList();
  } catch (error) {
    detailMessage.textContent = describeStorageError(error, "削除できませんでした");
  }
}

function getFileExtension(file) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) {
    return fromName;
  }

  const fromType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov"
  }[file.type];
  return fromType || "bin";
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function formatDate(isoText) {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

function describeStorageError(error, prefix) {
  if (error?.code === "storage/unauthorized") {
    return `${prefix}: Storageのセキュリティルールで ${MEDIA_FOLDER}/ への読み書きを許可してください。`;
  }
  if (error?.code === "storage/retry-limit-exceeded") {
    return `${prefix}: 通信環境を確認して再試行してください。`;
  }
  return `${prefix}: ${error?.message || error}`;
}
