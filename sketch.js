// 遠端攝影機與手勢偵測
// 電腦開啟：顯示 QR Code 等待連線
// 手機掃描：傳送攝影機畫面，並由電腦進行 ml5 運算

let video;
let handPose;
let hands = [];
let peer;
let myId;
let isHost = true; // 判斷是接收端(電腦)還是傳送端(手機)
let qrImage;
let statusText = "正在初始化連線...";

function preload() {
  // 初始化手勢偵測模型
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // 檢查 URL 是否有 hash (例如 #targetID)，有的話就是傳送端
  let hash = window.location.hash;
  if (hash && hash.length > 1) {
    isHost = false;
    let targetId = hash.substring(1);
    setupSender(targetId);
  } else {
    isHost = true;
    setupHost();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function setupHost() {
  // 1. 初始化 PeerJS
  peer = new Peer();
  
  peer.on('open', (id) => {
    myId = id;
    // 產生 QR Code 連結 (將當前網址加上 ID)
    let url = window.location.href.split('#')[0] + "#" + myId;
    qrImage = loadImage(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
    statusText = "請用手機掃描 QR Code 以連接相機";
    console.log("主機已就緒，等待 ID:", myId);
  });

  // 2. 當接收到手機傳來的影像時
  peer.on('call', (call) => {
    call.answer(); // 接聽，不需回傳本地影像
    call.on('stream', (remoteStream) => {
      // 將遠端 WebRTC 串流轉為 p5 video
      video = createVideo('');
      video.elt.srcObject = remoteStream;
      video.elt.muted = true;
      video.elt.play();
      video.hide();
      
      // 開始對遠端串流進行偵測
      handPose.detectStart(video, gotHands);
      statusText = "已連接遠端相機";
    });
  });
}

function setupSender(targetId) {
  // 手機端：啟動相機並呼叫電腦
  video = createCapture(VIDEO); // 手機端直接啟動
  video.size(640, 480);
  video.hide(); 

  peer = new Peer();
  peer.on('open', () => {
    // 檢查相機是否有串流
    let checkInterval = setInterval(() => {
      if (video.elt.srcObject) {
        peer.call(targetId, video.elt.srcObject);
        clearInterval(checkInterval);
        statusText = "影像傳送中，請查看電腦畫面";
      }
    }, 500);
  });
}

function gotHands(results) {
  hands = results;
}

function draw() {
  background(0);

  if (video && video.elt.srcObject) {
    // 顯示影像（如果是傳送端則顯示提示，如果是接收端則顯示畫面）
    if (isHost && video.width > 0) {
      // 計算影像縮放比例，以確保點位正確標註在全屏影像上
      let scaleX = width / video.width;
      let scaleY = height / video.height;

      image(video, 0, 0, width, height);

      // 繪製手部關節
      for (let hand of hands) {
        if (hand.confidence > 0.1) {
          fill(hand.handedness === "Left" ? "#FF00FF" : "#FFFF00");
          noStroke();
          for (let keypoint of hand.keypoints) {
            // 根據縮放比例調整點的位置
            circle(keypoint.x * scaleX, keypoint.y * scaleY, 10);
          }
        }
      }
    }
  }

  // 介面顯示
  fill(255);
  textAlign(CENTER, CENTER);

  // 如果是主機端，且還在載入中（沒影像也沒 QR Code）
  if (isHost && !video && !qrImage) {
    textSize(32); // 更顯眼的文字大小
    text(statusText, width / 2, height / 2);
  } else {
    textSize(16); // 一般狀態的文字大小
    text(statusText, width / 2, height - 30);
    if (isHost && qrImage && !video) {
      imageMode(CENTER);
      image(qrImage, width / 2, height / 2, 200, 200);
      imageMode(CORNER);
    }
  }
}
