// Elements
const library = document.getElementById("library");
const bookList = document.getElementById("book-list");
const emptyMsg = document.getElementById("empty-msg");
const tabs = document.querySelectorAll(".tab");

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
  viewer.src = book.pdf;

  library.style.display = "none";
  reader.style.display = "block";
  showReaderControls();

  updateFavButton();
  notesText.value = book.notes || "";
  notesStatus.textContent = "";
  notesPanel.style.display = "none";
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
