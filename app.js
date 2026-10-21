const updates = {
  apple: { points: "1.360", tier: "Impulso", message: "Demostración: el backend actualizó puntos y nivel del pase." },
  google: { points: "2,490", rewards: "4 available", message: "Demostración: Google Wallet mostraría los puntos y recompensas actualizados al sincronizar el objeto." }
};

document.querySelectorAll("[data-details]").forEach((button) => {
  button.addEventListener("click", () => {
    const details = document.getElementById(button.dataset.details);
    const willOpen = details.hidden;
    details.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
    button.textContent = willOpen ? "Ocultar detalles" : "Ver detalles";
  });
});

document.querySelectorAll("[data-update]").forEach((button) => {
  button.addEventListener("click", () => {
    const wallet = button.dataset.update;
    const change = updates[wallet];
    document.getElementById(`${wallet}-points`).textContent = change.points;
    if (change.tier) document.getElementById(`${wallet}-tier`).textContent = change.tier;
    if (change.rewards) document.getElementById(`${wallet}-rewards`).textContent = change.rewards;
    document.getElementById(`${wallet}-message`).textContent = change.message;
    button.disabled = true;
    button.textContent = "Actualización simulada";
  });
});

// QR Version 1-L generator. It supports the short numeric/alphanumeric pass tokens used here,
// keeps the prototypes dependency-free, and creates real SVG QR symbols rather than decorative art.
const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const QR_SIZE = 21;
const QR_DATA_CODEWORDS = 19;
const QR_ECC_CODEWORDS = 7;

function appendBits(bits, value, length) {
  for (let bit = length - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
}

function encodeQrData(value) {
  const numeric = /^\d+$/.test(value);
  const alphanumeric = [...value].every((char) => ALPHANUMERIC.includes(char));
  if (!numeric && !alphanumeric) throw new Error("The demonstration QR value is not QR Version 1 compatible.");

  const bits = [];
  appendBits(bits, numeric ? 0b0001 : 0b0010, 4);
  appendBits(bits, value.length, numeric ? 10 : 9);
  if (numeric) {
    for (let index = 0; index < value.length; index += 3) {
      const chunk = value.slice(index, index + 3);
      appendBits(bits, Number(chunk), chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4);
    }
  } else {
    for (let index = 0; index < value.length; index += 2) {
      const first = ALPHANUMERIC.indexOf(value[index]);
      if (index + 1 < value.length) appendBits(bits, first * 45 + ALPHANUMERIC.indexOf(value[index + 1]), 11);
      else appendBits(bits, first, 6);
    }
  }
  appendBits(bits, 0, Math.min(4, QR_DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let index = 0; index < bits.length; index += 8) data.push(parseInt(bits.slice(index, index + 8).join(""), 2));
  for (let pad = 0; data.length < QR_DATA_CODEWORDS; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);
  return data;
}

function gfMultiply(left, right) {
  let result = 0;
  let a = left;
  let b = right;
  while (b) {
    if (b & 1) result ^= a;
    a = (a << 1) ^ (a & 0x80 ? 0x11d : 0);
    b >>>= 1;
  }
  return result;
}

function reedSolomon(data) {
  let generator = [1];
  let alpha = 1;
  for (let degree = 0; degree < QR_ECC_CODEWORDS; degree += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, alpha);
    });
    generator = next;
    alpha = gfMultiply(alpha, 2);
  }
  const remainder = Array(QR_ECC_CODEWORDS).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    for (let index = 0; index < QR_ECC_CODEWORDS; index += 1) remainder[index] ^= gfMultiply(generator[index + 1], factor);
  });
  return remainder;
}

function degree(value) {
  let output = -1;
  while (value) { value >>>= 1; output += 1; }
  return output;
}

function formatBits(mask) {
  const data = (0b01 << 3) | mask; // L error correction level
  let remainder = data << 10;
  while (degree(remainder) >= 10) remainder ^= 0x537 << (degree(remainder) - 10);
  return ((data << 10) | remainder) ^ 0x5412;
}

function setFinder(matrix, row, column) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const targetRow = row + y;
      const targetColumn = column + x;
      if (targetRow < 0 || targetRow >= QR_SIZE || targetColumn < 0 || targetColumn >= QR_SIZE) continue;
      matrix[targetRow][targetColumn] = y >= 0 && y <= 6 && x >= 0 && x <= 6 && (y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4));
    }
  }
}

function qrMatrix(value) {
  const matrix = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(null));
  setFinder(matrix, 0, 0);
  setFinder(matrix, QR_SIZE - 7, 0);
  setFinder(matrix, 0, QR_SIZE - 7);
  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    matrix[6][index] = index % 2 === 0;
    matrix[index][6] = index % 2 === 0;
  }
  for (let index = 0; index < 15; index += 1) {
    if (index < 6) matrix[index][8] = false;
    else if (index < 8) matrix[index + 1][8] = false;
    else matrix[QR_SIZE - 15 + index][8] = false;
    if (index < 8) matrix[8][QR_SIZE - index - 1] = false;
    else if (index < 9) matrix[8][15 - index] = false;
    else matrix[8][15 - index - 1] = false;
  }
  matrix[QR_SIZE - 8][8] = true;

  const codewords = [...encodeQrData(value), ...reedSolomon(encodeQrData(value))];
  const bits = codewords.flatMap((word) => Array.from({ length: 8 }, (_, bit) => (word >>> (7 - bit)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let column = QR_SIZE - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    for (let offset = 0; offset < QR_SIZE; offset += 1) {
      const row = upward ? QR_SIZE - 1 - offset : offset;
      for (let right = 0; right < 2; right += 1) {
        const targetColumn = column - right;
        if (matrix[row][targetColumn] !== null) continue;
        let bit = bits[bitIndex++] ?? 0;
        if ((row + targetColumn) % 2 === 0) bit ^= 1;
        matrix[row][targetColumn] = Boolean(bit);
      }
    }
    upward = !upward;
  }

  const format = formatBits(0);
  for (let index = 0; index < 15; index += 1) {
    const bit = Boolean((format >>> index) & 1);
    if (index < 6) matrix[index][8] = bit;
    else if (index < 8) matrix[index + 1][8] = bit;
    else matrix[QR_SIZE - 15 + index][8] = bit;
    if (index < 8) matrix[8][QR_SIZE - index - 1] = bit;
    else if (index < 9) matrix[8][15 - index] = bit;
    else matrix[8][15 - index - 1] = bit;
  }
  return matrix;
}

function renderQr(container) {
  const modules = qrMatrix(container.dataset.qrValue);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 29 29");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", container.getAttribute("aria-label"));
  const background = document.createElementNS(svg.namespaceURI, "rect");
  background.setAttribute("width", "29");
  background.setAttribute("height", "29");
  background.setAttribute("fill", "white");
  svg.append(background);
  modules.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
    if (!dark) return;
    const square = document.createElementNS(svg.namespaceURI, "rect");
    square.setAttribute("x", String(columnIndex + 4));
    square.setAttribute("y", String(rowIndex + 4));
    square.setAttribute("width", "1");
    square.setAttribute("height", "1");
    square.setAttribute("fill", "#000");
    svg.append(square);
  }));
  container.replaceChildren(svg);
}

document.querySelectorAll("[data-qr-value]").forEach(renderQr);
