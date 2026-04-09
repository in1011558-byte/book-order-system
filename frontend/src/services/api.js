// Google Books API integration with localStorage-based data management
const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const MAX_RESULTS = 40;
const MAX_PAGES = 5;

// Helper function to get user-specific data key
const getUserDataKey = (baseKey) => {
  const token = localStorage.getItem('authToken');
  return token ? `${baseKey}_${token}` : baseKey;
};

// ================== Google Books Search ==================
const searchBooks = async (query, searchType = 'title') => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { books: [], total: 0 };
  }

  // Multiple search strategies to find ALL available books
  const searchStrategies = [
    { q: trimmedQuery, label: '基本検索', maxPages: 3 },
    { q: `intitle:${trimmedQuery}`, label: 'タイトル検索', maxPages: 2 },
    { q: `${trimmedQuery} 巻`, label: '巻数検索', maxPages: 1 }
  ];

  const allBooks = new Map(); // Use Map to deduplicate by ISBN

  for (const strategy of searchStrategies) {
    console.log(`Searching with strategy: ${strategy.label}`);
    
    // Fetch multiple pages for each strategy
    const pagesToFetch = strategy.maxPages || MAX_PAGES;
    for (let page = 0; page < pagesToFetch; page++) {
      const startIndex = page * MAX_RESULTS;
      const url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(strategy.q)}&maxResults=${MAX_RESULTS}&startIndex=${startIndex}&langRestrict=ja`;
      
      try {
        const response = await fetch(url);
        
        // Check if response is OK
        if (!response.ok) {
          console.warn(`API returned ${response.status} for ${strategy.label}`);
          if (response.status === 429 || response.status === 423) {
            // Rate limit or locked - wait and skip to next strategy
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
          break;
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          break; // No more results for this strategy
        }

        data.items.forEach(item => {
          const volumeInfo = item.volumeInfo;
          const saleInfo = item.saleInfo;
          
          // Extract ISBNs
          const isbns = volumeInfo.industryIdentifiers || [];
          const isbn13 = isbns.find(id => id.type === 'ISBN_13')?.identifier;
          const isbn10 = isbns.find(id => id.type === 'ISBN_10')?.identifier;
          const isbn = isbn13 || isbn10 || item.id;

          // Only add if not already present (deduplicate)
          if (!allBooks.has(isbn)) {
            allBooks.set(isbn, {
              isbn,
              title: volumeInfo.title || '不明',
              author: (volumeInfo.authors || ['不明']).join(', '),
              publisher: volumeInfo.publisher || '不明',
              publishedDate: volumeInfo.publishedDate || '',
              description: volumeInfo.description || '',
              thumbnail: volumeInfo.imageLinks?.thumbnail || '',
              price: saleInfo?.listPrice?.amount || 0,
              currency: saleInfo?.listPrice?.currencyCode || 'JPY',
              pageCount: volumeInfo.pageCount || 0,
              categories: (volumeInfo.categories || []).join(', ')
            });
          }
        });
      } catch (error) {
        console.error(`Error in strategy ${strategy.label}:`, error);
      }
    }
  }

  const books = Array.from(allBooks.values());
  console.log(`Total unique books found: ${books.length}`);
  
  return {
    books,
    total: books.length
  };
};

// ================== User Authentication ==================
const register = (userData) => {
  try {
    // Check if user already exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.username === userData.username || u.email === userData.email)) {
      return { error: 'ユーザー名またはメールアドレスが既に使用されています' };
    }

    // Create new user
    const newUser = {
      ...userData,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Auto login
    const token = `token_${newUser.id}_${Date.now()}`;
    localStorage.setItem('authToken', token);
    localStorage.setItem(`user_${token}`, JSON.stringify(newUser));

    return { success: true, user: newUser, token };
  } catch (error) {
    return { error: error.message };
  }
};

const login = (credentials) => {
  try {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => 
      (u.username === credentials.username || u.email === credentials.username) &&
      u.password === credentials.password
    );

    if (!user) {
      return { error: 'ユーザー名またはパスワードが正しくありません' };
    }

    // Create token
    const token = `token_${user.id}_${Date.now()}`;
    localStorage.setItem('authToken', token);
    localStorage.setItem(`user_${token}`, JSON.stringify(user));

    return { success: true, user, token };
  } catch (error) {
    return { error: error.message };
  }
};

const logout = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    localStorage.removeItem(`user_${token}`);
    localStorage.removeItem('authToken');
  }
};

const getCurrentUser = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  
  const userJson = localStorage.getItem(`user_${token}`);
  return userJson ? JSON.parse(userJson) : null;
};

// ================== Wishlist Management ==================
const getWishlist = () => {
  const key = getUserDataKey('wishlist');
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const addToWishlist = (book) => {
  try {
    const wishlist = getWishlist();
    if (wishlist.find(item => item.isbn === book.isbn)) {
      return { error: 'この書籍は既にウィッシュリストに追加されています' };
    }
    wishlist.push(book);
    const key = getUserDataKey('wishlist');
    localStorage.setItem(key, JSON.stringify(wishlist));
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

const removeFromWishlist = (isbn) => {
  const wishlist = getWishlist();
  const filtered = wishlist.filter(item => item.isbn !== isbn);
  const key = getUserDataKey('wishlist');
  localStorage.setItem(key, JSON.stringify(filtered));
};

// ================== Cart Management (Date-based) ==================
const getCart = (date = null) => {
  const currentDate = date || new Date().toISOString().split('T')[0];
  const key = getUserDataKey(`cart_${currentDate}`);
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const getAllCartDates = () => {
  const token = localStorage.getItem('authToken');
  const prefix = token ? `cart_${token}_` : 'cart_';
  const dates = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const date = key.replace(prefix, '').replace('cart_', '');
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.push(date);
      }
    }
  }
  
  return dates.sort().reverse();
};

const addToCart = (book, date = null) => {
  try {
    const currentDate = date || new Date().toISOString().split('T')[0];
    const cart = getCart(currentDate);
    const existing = cart.find(item => item.isbn === book.isbn);
    
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({ ...book, quantity: 1, addedDate: currentDate });
    }
    
    const key = getUserDataKey(`cart_${currentDate}`);
    localStorage.setItem(key, JSON.stringify(cart));
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
};

const removeFromCart = (isbn, date = null) => {
  const currentDate = date || new Date().toISOString().split('T')[0];
  const cart = getCart(currentDate);
  const filtered = cart.filter(item => item.isbn !== isbn);
  const key = getUserDataKey(`cart_${currentDate}`);
  localStorage.setItem(key, JSON.stringify(filtered));
};

const updateCartQuantity = (isbn, quantity, date = null) => {
  const currentDate = date || new Date().toISOString().split('T')[0];
  const cart = getCart(currentDate);
  const item = cart.find(item => item.isbn === isbn);
  if (item) {
    item.quantity = Math.max(1, quantity);
    const key = getUserDataKey(`cart_${currentDate}`);
    localStorage.setItem(key, JSON.stringify(cart));
  }
};

const clearCart = (date = null) => {
  const currentDate = date || new Date().toISOString().split('T')[0];
  const key = getUserDataKey(`cart_${currentDate}`);
  localStorage.removeItem(key);
};

// ================== Order History Management ==================
const saveOrder = (cart, userInfo) => {
  if (!cart || cart.length === 0) {
    return;
  }

  const token = localStorage.getItem('authToken');
  if (!token) {
    return;
  }

  // Get existing orders
  const ordersKey = `orders_${token}`;
  const existingOrders = JSON.parse(localStorage.getItem(ordersKey) || '[]');

  // Create new order
  const newOrder = {
    id: Date.now(),
    date: new Date().toISOString(),
    items: cart,
    total: cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0),
    quantity: cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
    user: userInfo
  };

  // Add to orders
  existingOrders.push(newOrder);
  localStorage.setItem(ordersKey, JSON.stringify(existingOrders));
};

const getAllOrders = () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    return [];
  }

  const ordersKey = `orders_${token}`;
  return JSON.parse(localStorage.getItem(ordersKey) || '[]');
};

// ================== CSV Export ==================
const exportToCSV = (cart, userInfo = {}) => {
  if (!cart || cart.length === 0) {
    throw new Error('カートが空です');
  }

  // CSV header with BOM for proper Japanese character encoding
  const BOM = '\uFEFF';
  const header = ['書名', '著者', '出版社', 'ISBN', '価格', '数量', '小計'].join(',');
  
  const rows = cart.map(item => {
    const row = [
      `"${item.title || ''}"`,
      `"${item.author || ''}"`,
      `"${item.publisher || ''}"`,
      `"${item.isbn || ''}"`,
      item.price || 0,
      item.quantity || 1,
      (item.price || 0) * (item.quantity || 1)
    ];
    return row.join(',');
  });

  const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const totalRow = `\n合計,,,,,,\"¥${total.toLocaleString()}\"`;

  const csvContent = BOM + header + '\n' + rows.join('\n') + totalRow;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  return blob;
};

// Export all functions
const API = {
  searchBooks,
  register,
  login,
  logout,
  getCurrentUser,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getCart,
  getAllCartDates,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  saveOrder,
  getAllOrders,
  exportToCSV
};

export default API;
