/**
 * KRISHNA ENTERPRISES - PDF Script with Professional Search
 * Logic: Renders PDF to transparent canvases + Extracts text for searching
 */

const url = "./LS.pdf";

// Ensure worker matches the library version used in HTML
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const container = document.getElementById("pdf-container");
const overlay = document.getElementById("loading-overlay");
const percentText = document.getElementById("loading-percent");
const searchInput = document.getElementById("pdf-search");

let pdfDoc = null;
let zoom = 1.5;
let rendered = 0;
let total = 0;
let pagesData = []; // Array of { canvas, text }

// 1. INITIALIZE PDF
pdfjsLib.getDocument(url).promise.then(pdf => {
  pdfDoc = pdf;
  total = pdf.numPages;
  pagesData = new Array(total);
  renderAllPages();
}).catch(err => {
  console.error("PDF Load Error:", err);
  overlay.classList.add("hidden");
  document.body.classList.remove("no-scroll");
  const errorMsg = document.createElement('div');
  errorMsg.style.cssText = "padding:20px; color:red; font-weight:bold; text-align:center;";
  errorMsg.textContent = "Error: Could not load PDF file. Please check if LS.pdf exists.";
  container.appendChild(errorMsg);
});

// 2. RENDER LOOP
async function renderAllPages() {
  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: zoom });

      // Create Canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: true });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.id = `page-${i}`;

      // Start Rendering and Text Extraction simultaneously
      const renderTask = page.render({ canvasContext: ctx, viewport }).promise;
      const textTask = page.getTextContent();

      const [_, textContent] = await Promise.all([renderTask, textTask]);

      // Process Canvas (Transparency)
      removeWhite(canvas);

      // Process Text (Normalization for search)
      // We join items, remove extra spaces, and lowercase everything
      const rawStrings = textContent.items.map(item => item.str);
      const pageText = rawStrings.join(" ").replace(/\s+/g, " ").toLowerCase();

      // Store data in correct order
      pagesData[i - 1] = {
        canvas: canvas,
        text: pageText
      };

      rendered++;
      updateLoadingUI();

      if (rendered === total) {
        finalizeDisplay();
      }
    } catch (err) {
      console.warn(`Skipping page ${i} due to error:`, err);
      rendered++;
      updateLoadingUI();
    }
  }
}

// 3. UI UPDATES
function updateLoadingUI() {
  const pct = Math.floor((rendered / total) * 100);
  percentText.textContent = pct + "%";
}

function finalizeDisplay() {
  overlay.classList.add("hidden");
  document.body.classList.remove("no-scroll");

  // Check if PDF actually has text (to warn if it's just an image)
  const combinedText = pagesData.map(p => p.text).join("");
  if (combinedText.trim().length < 20) {
    console.warn("Search Alert: This PDF seems to be an image scan. No searchable text found.");
  }

  // Append canvases to the container in order
  pagesData.forEach(pageObj => {
    if (pageObj && pageObj.canvas) {
      container.appendChild(pageObj.canvas);
      // Trigger fade-in effect
      setTimeout(() => pageObj.canvas.classList.add("visible"), 50);
    }
  });
}

// 4. IMAGE PROCESSING (TRANSPARENCY)
function removeWhite(canvas, threshold = 250) {
  const ctx = canvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Check if Pixel is near-white
    if (data[i] >= threshold && data[i+1] >= threshold && data[i+2] >= threshold) {
      data[i+3] = 0; // Set Alpha to 0 (Transparent)
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// 5. SEARCH LOGIC
let searchTimeout;
searchInput.addEventListener("input", (e) => {
  // Use debounce to prevent stuttering while typing
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = e.target.value.toLowerCase().trim();

    // Reset all highlights
    pagesData.forEach(p => {
      if (p && p.canvas) p.canvas.classList.remove("highlight-match");
    });

    if (!query || query.length < 2) return;

    // Find the first page that contains the query string
    const match = pagesData.find(p => p && p.text.includes(query));

    if (match) {
      // Professional smooth scroll to the matched page
      match.canvas.scrollIntoView({ 
        behavior: "smooth", 
        block: "center" 
      });

      // Visual feedback: Page "Glow"
      match.canvas.classList.add("highlight-match");
      searchInput.style.boxShadow = "0 0 5px green";
    } else {
      // Visual feedback: No match
      searchInput.style.boxShadow = "0 0 5px red";
    }
  }, 300);
});
