/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsButton = document.getElementById("clearSelections");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");
const storageKey = "loreal-selected-products";
const selectedProducts = loadSelectedProducts();
let allProducts = [];
let conversationMessages = [];
const workerUrl = "https://holy-mud-afa1.lilgamelvr42.workers.dev";
const systemMessage = {
  role: "system",
  content:
    "You are a L'Oréal skincare and beauty advisor. Answer questions about the generated routine and related topics such as skincare, haircare, makeup, fragrance, and product use. If a question is unrelated to these topics, politely explain that you can only help with beauty and routine questions. Use the selected products and the full conversation history to give helpful, safe answers.",
};

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;
displaySelectedProducts();

/* Restore selected products from the browser's local storage */
function loadSelectedProducts() {
  try {
    const savedProducts = localStorage.getItem(storageKey);
    if (!savedProducts) {
      return [];
    }

    const products = JSON.parse(savedProducts);
    return Array.isArray(products) ? products : [];
  } catch (error) {
    console.error("Could not load saved products.", error);
    return [];
  }
}

/* Save the current selection so it survives a page reload */
function saveSelectedProducts() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(selectedProducts));
  } catch (error) {
    console.error("Could not save selected products.", error);
  }
}

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div
      class="product-card ${
        selectedProducts.some((selectedProduct) => selectedProduct.id === product.id)
          ? "selected"
          : ""
      }"
      data-product-id="${product.id}"
      role="button"
      tabindex="0"
      aria-pressed="${selectedProducts.some(
        (selectedProduct) => selectedProduct.id === product.id
      )}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <details class="product-description">
          <summary>View description</summary>
          <p>${product.description}</p>
        </details>
      </div>
    </div>
  `
    )
    .join("");
  clearSelectionsButton.disabled = false;
}

/* Show the products the user has selected */
function displaySelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="empty-selection">No products selected yet.</p>`;
    clearSelectionsButton.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product" data-product-id="${product.id}">
        <span>${product.name}</span>
        <button
          type="button"
          class="remove-product"
          aria-label="Remove ${product.name}"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `
    )
    .join("");
}

/* Add or remove a product when its card is clicked */
async function toggleProduct(productId) {
  const productIndex = selectedProducts.findIndex(
    (product) => product.id === productId
  );

  if (productIndex === -1) {
    const products = await loadProducts();
    const product = products.find((item) => item.id === productId);
    if (product && !selectedProducts.some((item) => item.id === productId)) {
      selectedProducts.push(product);
      saveSelectedProducts();
      displaySelectedProducts();
      displayProducts(products.filter(
        (item) => item.category === categoryFilter.value
      ));
    }
  } else {
    selectedProducts.splice(productIndex, 1);
    saveSelectedProducts();
    displaySelectedProducts();
    displayProducts(allProducts.filter(
      (item) => item.category === categoryFilter.value
    ));
  }
}

/* Handle clicks and keyboard activation on product cards */
productsContainer.addEventListener("click", (e) => {
  if (e.target.closest(".product-description")) {
    return;
  }

  const card = e.target.closest(".product-card");
  if (card) {
    toggleProduct(Number(card.dataset.productId));
  }
});

/* Remove all saved products at once */
clearSelectionsButton.addEventListener("click", () => {
  selectedProducts.length = 0;
  saveSelectedProducts();
  displaySelectedProducts();
  displayProducts(allProducts.filter(
    (item) => item.category === categoryFilter.value
  ));
});

productsContainer.addEventListener("keydown", (e) => {
  if (e.target.closest(".product-description")) {
    return;
  }

  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".product-card");
    if (card) {
      e.preventDefault();
      toggleProduct(Number(card.dataset.productId));
    }
  }
});

/* Handle remove buttons in the selected products list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-product");
  if (removeButton) {
    const productId = Number(
      removeButton.closest(".selected-product").dataset.productId
    );
    toggleProduct(productId);
  }
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Show the conversation without treating AI responses as HTML */
function displayConversation() {
  chatWindow.innerHTML = "";

  conversationMessages
    .filter((message) => message.role !== "system")
    .forEach((message) => {
      const messageElement = document.createElement("p");
      messageElement.className = `chat-message ${message.role}`;
      let visibleContent = message.content;

      /* Keep the internal product JSON out of the visible conversation */
      if (
        message.role === "user" &&
        message.content.startsWith("Create a personalized routine")
      ) {
        const productData = message.content.slice(
          message.content.indexOf("[")
        );

        try {
          const products = JSON.parse(productData);
          const productNames = products
            .map((product) => `- ${product.name}`)
            .join("\n");
          visibleContent = `Create a personalized routine using:\n${productNames}`;
        } catch (error) {
          console.error("Could not display selected product names.", error);
          visibleContent = "Create a personalized routine using my selected products.";
        }
      } else if (message.role === "assistant") {
        /* Remove common Markdown markers while preserving line breaks and bullets */
        visibleContent = message.content
          .replace(/\*\*/g, "")
          .replace(/^#{1,6}\s*/gm, "");
      }

      messageElement.textContent = `${
        message.role === "user" ? "You" : "Advisor"
      }: ${visibleContent}`;
      chatWindow.appendChild(messageElement);
    });

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send the complete conversation to the class-hosted worker */
async function requestAssistantResponse(messages) {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`The chat request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error("The chat response did not include any content.");
  }

  return reply;
}

/* Generate a routine using only the products the user selected */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.textContent = "Select at least one product to generate a routine.";
    return;
  }

  const productsForRoutine = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const originalButtonText = generateRoutineButton.innerHTML;
  generateRoutineButton.disabled = true;
  generateRoutineButton.textContent = "Generating routine...";
  chatWindow.textContent = "Generating your personalized routine...";

  try {
    conversationMessages = [
      systemMessage,
      {
        role: "user",
        content: `Create a personalized routine using these selected products:\n${JSON.stringify(
          productsForRoutine,
          null,
          2
        )}`,
      },
    ];
    const routine = await requestAssistantResponse(conversationMessages);
    conversationMessages.push({ role: "assistant", content: routine });
    displayConversation();
  } catch (error) {
    conversationMessages = [];
    chatWindow.textContent = `Unable to generate a routine: ${error.message}`;
  } finally {
    generateRoutineButton.disabled = false;
    generateRoutineButton.innerHTML = originalButtonText;
  }
});

/* Send follow-up questions with the complete conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const question = userInput.value.trim();
  if (conversationMessages.length === 0) {
    chatWindow.textContent = "Generate a routine first to start a conversation.";
    return;
  }
  if (!question) {
    return;
  }

  sendButton.disabled = true;
  userInput.disabled = true;
  conversationMessages.push({ role: "user", content: question });
  userInput.value = "";
  displayConversation();

  try {
    const reply = await requestAssistantResponse(conversationMessages);
    conversationMessages.push({ role: "assistant", content: reply });
    displayConversation();
  } catch (error) {
    conversationMessages.pop();
    displayConversation();
    chatWindow.insertAdjacentText(
      "beforeend",
      `\nUnable to send your question: ${error.message}`
    );
  } finally {
    sendButton.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
});
