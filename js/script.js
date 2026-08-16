// Elements
const library = document.getElementById("library");
const bookList = document.getElementById("book-list");
const emptyMsg = document.getElementById("empty-msg");
const tabs = document.querySelectorAll(".tab[data-tab]");
const publishBtn = document.getElementById("publish-btn");
const publishInput = document.getElementById("publish-input");
const publishStatus = document.getElementById("publish-status");

const reader = document.getElementById("reader");
const viewer = document.getElementById("viewer");
const readerControls = document.getElementById("reader-controls");
const favToggle = document.getElementById("fav-toggle");
const notesToggle = document.getElementById("notes-toggle");
const hideControls = document.getElementById("hide-controls");
const showControls = document.getElementById("show-controls");
const notesPanel = document.getElementById("notes-panel");
const notesText = document.getElementById("notes-text");
const notesStatus = document.getElementById("notes-status");

// State
let books = [];          // all books from the API
let currentTab = "all";  // "all" | "favorites"
let currentBook = null;  // book currently open in the reader

// Load the library, then render
fetch("/api/books")
  .then((response) => response.json())
  .then((data) => {
    books = data;
    render();
  });

function render() {
  const visible = currentTab === "favorites"
    ? books.filter((b) => b.favorite)
    : books;

  bookList.innerHTML = "";

  visible.forEach((book) => {
    const card = document.createElement("div");
    card.className = "book";
    card.innerHTML = `
      <div class="cover-wrap">
        <img src="${book.cover}" alt="${book.title}">
        <button class="star ${book.favorite ? "on" : ""}" title="Favorite">
          ${book.favorite ? "★" : "☆"}
        </button>
      </div>
      <p>${book.title}</p>
    `;

    // Open the book (but not when the star was clicked)
    card.addEventListener("click", () => openBook(book));

    const star = card.querySelector(".star");
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(book);
    });

    bookList.appendChild(card);
  });

  emptyMsg.style.display =
    currentTab === "favorites" && visible.length === 0 ? "block" : "none";
}

// --- Tabs ---
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    render();
  });
});

// --- Favorites ---
function toggleFavorite(book) {
  const next = !book.favorite;
  book.favorite = next; // optimistic update

  fetch("/api/favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: book.id, favorite: next }),
  }).catch(() => {
    book.favorite = !next; // revert on failure
    render();
  });

  if (currentBook && currentBook.id === book.id) updateFavButton();
  render();
}

function updateFavButton() {
  favToggle.textContent = currentBook.favorite ? "★" : "☆";
  favToggle.classList.toggle("on", currentBook.favorite);
}

favToggle.addEventListener("click", () => {
  if (currentBook) toggleFavorite(currentBook);
});

// --- Reader ---
function openBook(book) {
  currentBook = book;

  // Open the PDF.js viewer. We restore the saved page programmatically once the
  // viewer is ready (see trackProgress) rather than via a URL #page= hash, which
  // the viewer doesn't reliably honor on initial load.
  viewer.src = "/pdfjs/web/viewer.html?file=" + encodeURIComponent(book.pdf);

  library.style.display = "none";
  reader.style.display = "block";
  showReaderControls();

  updateFavButton();
  notesText.value = book.notes || "";
  notesStatus.textContent = "";
  notesPanel.style.display = "none";

  trackProgress(book);
}

// --- Reading progress: follow the viewer's page and save it ---
let progressTimer = null;

function trackProgress(book) {
  const startPage = book.page && book.page > 1 ? book.page : 1;

  const attach = () => {
    const app = viewer.contentWindow && viewer.contentWindow.PDFViewerApplication;
    if (!app || !app.initializedPromise) return false;

    app.initializedPromise.then(() => {
      // Jump to the saved page. If the pages are already laid out we can set it
      // now; otherwise wait for the viewer's "pagesinit" event.
      const goToStart = () => {
        if (startPage > 1 && currentBook && currentBook.id === book.id) {
          app.pdfViewer.currentPageNumber = startPage;
        }
      };
      if (app.pdfViewer && app.pdfViewer.pagesCount > 0) {
        goToStart();
      } else {
        app.eventBus.on("pagesinit", goToStart);
      }

      app.eventBus.on("pagechanging", (evt) => {
        // Ignore late events from a book we've already closed/switched away from.
        if (!currentBook || currentBook.id !== book.id) return;
        currentBook.page = evt.pageNumber;
        saveProgress(book.id, evt.pageNumber);
      });
    });
    return true;
  };

  viewer.addEventListener("load", function onLoad() {
    viewer.removeEventListener("load", onLoad);
    if (attach()) return;
    // The viewer app may not be ready the instant the iframe loads; poll briefly.
    let tries = 0;
    const poll = setInterval(() => {
      if (attach() || ++tries > 40) clearInterval(poll);
    }, 100);
  });
}

function saveProgress(id, page) {
  clearTimeout(progressTimer); // debounce rapid page turns into one save
  progressTimer = setTimeout(() => {
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, page }),
    }).catch(() => {});
  }, 800);
}

function goToMenu() {
  viewer.src = "";
  currentBook = null;

  reader.style.display = "none";
  library.style.display = "block";
  render(); // reflect any favorite changes made while reading
}

// --- Immersive mode: hide/show the controls so it's just the PDF ---
function showReaderControls() {
  readerControls.style.display = "flex";
  showControls.style.display = "none";
}

hideControls.addEventListener("click", () => {
  readerControls.style.display = "none";
  notesPanel.style.display = "none";
  showControls.style.display = "block";
});

showControls.addEventListener("click", showReaderControls);

// --- Notes ---
notesToggle.addEventListener("click", () => {
  const open = notesPanel.style.display !== "none";
  notesPanel.style.display = open ? "none" : "flex";
});

let notesTimer = null;
notesText.addEventListener("input", () => {
  if (!currentBook) return;
  currentBook.notes = notesText.value;
  notesStatus.textContent = "Saving…";

  clearTimeout(notesTimer);
  notesTimer = setTimeout(saveNotes, 600); // debounce
});

function saveNotes() {
  if (!currentBook) return;
  fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: currentBook.id, notes: currentBook.notes }),
  })
    .then(() => { notesStatus.textContent = "Saved"; })
    .catch(() => { notesStatus.textContent = "Save failed"; });
}

// --- Publish a PDF ---
function showPublishStatus(message, isError) {
  publishStatus.textContent = message;
  publishStatus.style.color = isError ? "#e57373" : "#9c9187";
  publishStatus.style.display = "block";
}

publishBtn.addEventListener("click", () => publishInput.click());

publishInput.addEventListener("change", () => {
  const file = publishInput.files[0];
  if (!file) return;

  showPublishStatus(`Publishing “${file.name}”…`, false);
  publishBtn.disabled = true;

  const form = new FormData();
  form.append("pdf", file);

  fetch("/api/publish", { method: "POST", body: form })
    .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || "publish failed");
      showPublishStatus(`Published “${file.name}”.`, false);
      // Reload the library so the new book (and its cover) appear.
      return fetch("/api/books")
        .then((r) => r.json())
        .then((list) => { books = list; render(); });
    })
    .catch((err) => showPublishStatus(err.message, true))
    .finally(() => {
      publishBtn.disabled = false;
      publishInput.value = ""; // allow re-selecting the same file
    });
});
