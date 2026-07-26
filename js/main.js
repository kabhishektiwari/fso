async function loadJSON(path) {
  try {
    const res = await fetch(path);
    return await res.json();
  } catch (e) {
    console.error("Error loading JSON:", path, e);
    return null;
  }
}

function calculateReadingTime(text) {
  if (!text) return 1;
  const cleanText = text.replace(/<[^>]+>/g, "").trim();
  const words = cleanText ? cleanText.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

function formatViews(num) {
  if (!num) return "1.2k views";
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k views";
  }
  return num + " views";
}

function parseDateToTimestamp(dateStr) {
  if (!dateStr) return 0;
  // Format example: "2026-07-26 09:30 AM" or "18/06/2026 11:25 AM"
  try {
    const d = new Date(dateStr.replace(/-/g, '/'));
    if (!isNaN(d.getTime())) return d.getTime();
  } catch (e) {}
  return 0;
}

function formatDateDDMonthYYYY(dateStr) {
  if (!dateStr) return "26 July 2026";
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  const cleanStr = String(dateStr).trim();

  // Try YYYY-MM-DD or YYYY/MM/DD
  const yyyymmddMatch = cleanStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')} ${months[month]} ${year}`;
    }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = cleanStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')} ${months[month]} ${year}`;
    }
  }

  // Fallback to JS Date parse
  try {
    const d = new Date(cleanStr.replace(/-/g, '/'));
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    }
  } catch (e) {}

  return cleanStr.split(' ')[0] || "26 July 2026";
}

document.addEventListener("DOMContentLoaded", async () => {
  // Update header current date
  const currentDateEl = document.getElementById("currentDateDisplay");
  if (currentDateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

  const storiesData = await loadJSON("data/stories.json");
  let stories = storiesData ? (Array.isArray(storiesData) ? storiesData : storiesData.stories) : [];
  const authors = await loadJSON("data/authors.json") || {};

  // Compute author stats (articles count & total views)
  const authorStats = {};
  Object.keys(authors).forEach(id => {
    authorStats[id] = { count: 0, views: 0 };
  });

  stories.forEach(s => {
    const aid = s.authorId || "k_abhishektiwari";
    if (!authorStats[aid]) {
      authorStats[aid] = { count: 0, views: 0 };
    }
    authorStats[aid].count += 1;
    authorStats[aid].views += (s.views || 1000);
  });

  /* =========================================================
     1. HOME PAGE (index.html)
     ========================================================= */
  const storiesEl = document.getElementById("stories");
  const navEl = document.getElementById("categoryNav");
  const trendingHeroCardEl = document.getElementById("trendingHeroCard");
  const authorsGridEl = document.getElementById("authorsGrid");
  const searchInputEl = document.getElementById("searchInput");
  const viewAllBtn = document.getElementById("viewAllBtn");
  const postCountBadge = document.getElementById("postCountBadge");

  if (storiesEl && navEl) {
    let currentCategory = "All";
    let searchQuery = "";
    let displayLimit = 20; // Default limit for Section 2

    // Sort stories by newest first
    stories.sort((a, b) => {
      const timeA = parseDateToTimestamp(a.createdAt);
      const timeB = parseDateToTimestamp(b.createdAt);
      if (timeA && timeB) return timeB - timeA;
      return (b.id || 0) - (a.id || 0);
    });

    // Helper: Generate 3 automated AI summary takeaways for any hero story (filtering out welcome/intro fluff)
    function generateAITakeaways(story) {
      if (!story) return [];

      if (story.takeaways && Array.isArray(story.takeaways) && story.takeaways.length >= 3) {
        return story.takeaways.slice(0, 3);
      }

      const points = [];

      // Check if text is introductory / welcome fluff
      const isFluff = (text) => {
        if (!text) return true;
        const lower = text.toLowerCase().trim();
        return (
          lower.includes("welcome") ||
          lower.includes("hello") ||
          lower.includes("farsight writer") ||
          lower.includes("daily financial chronicle") ||
          lower.includes("in this article") ||
          lower.includes("in today's report") ||
          lower.includes("in this report") ||
          lower.includes("today we explore") ||
          lower.includes("thanks for reading") ||
          lower.includes("key report metrics") ||
          lower.includes("subscribe") ||
          lower.startsWith("#")
        );
      };

      // 1. Try extracting explicit bullet points from story body
      if (story.body) {
        const lines = story.body.split('\n');
        for (let line of lines) {
          const trimmed = line.trim();
          if (/^(\*|-|\d+\.)\s+/.test(trimmed)) {
            let clean = trimmed
              .replace(/^(\*|-|\d+\.)\s+/, '')
              .replace(/\*\*/g, '')
              .replace(/\[(.*?)\]\(.*?\)/g, '$1')
              .trim();
            clean = clean.replace(/^[0-9]+\.\s*/, '');
            if (clean.length > 20 && !isFluff(clean) && !points.includes(clean)) {
              points.push(clean);
            }
          }
          if (points.length >= 3) break;
        }
      }

      // 2. Extract key analytical sentences from body paragraphs
      if (points.length < 3 && story.body) {
        const rawParagraphs = story.body.split(/\n\n+/);
        for (let rawP of rawParagraphs) {
          const p = rawP.trim();
          if (p.startsWith('#') || p.startsWith('|') || p.startsWith('---') || isFluff(p)) continue;

          const sentences = p.split(/(?<=[.!?])\s+/);
          for (let s of sentences) {
            let cleanSentence = s.replace(/\*\*/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();
            if (cleanSentence.length > 30 && cleanSentence.length < 180 && !isFluff(cleanSentence)) {
              if (!points.some(existing => existing.toLowerCase().includes(cleanSentence.toLowerCase().slice(0, 20)))) {
                points.push(cleanSentence);
              }
            }
            if (points.length >= 3) break;
          }
          if (points.length >= 3) break;
        }
      }

      // 3. Fallback: Utilize story.about summary
      if (points.length < 3 && story.about && !isFluff(story.about)) {
        const aboutSentences = story.about.split(/(?<=[.!?])\s+/);
        for (let s of aboutSentences) {
          let clean = s.replace(/\*\*/g, '').trim();
          if (clean.length > 25 && !isFluff(clean) && !points.includes(clean)) {
            points.push(clean);
          }
          if (points.length >= 3) break;
        }
      }

      // 4. Domain-intelligent fallback points tailored to article category
      const cat = story.category || 'global market';
      if (points.length < 1) points.push(`Critical macroeconomic analysis on ${cat} dynamics and structural capital flows.`);
      if (points.length < 2) points.push(`Central bank policy and institutional liquidity drive broader valuation trends.`);
      if (points.length < 3) points.push(`Sovereign debt metrics and global geopolitical risk factors influence market sentiment.`);

      return points.slice(0, 3);
    }

    // Helper: Render Hero Card dynamically whenever story changes
    function renderHeroCard(heroStory) {
      if (!trendingHeroCardEl || !heroStory) return;

      const author = authors[heroStory.authorId] || { name: "Financial Editor", avatar: "images/authors/myprofilecircle.png", role: "Markets Analyst" };
      const readTime = calculateReadingTime(heroStory.body);
      const formattedViews = formatViews(heroStory.views);
      const formattedDate = formatDateDDMonthYYYY(heroStory.createdAt);

      trendingHeroCardEl.innerHTML = `
        <div class="trending-hero-card">
          <div class="hero-card-header-badge">
            ${heroStory.category || "World"} • ${heroStory.tag || "Analysis"}
          </div>
          <h2 class="trending-title" onclick="location.href='story.html?id=${heroStory.id}'">
            ${heroStory.title}
          </h2>
          <div class="trending-excerpt-block">
            <p class="trending-excerpt" onclick="location.href='story.html?id=${heroStory.id}'">${heroStory.about || "Key financial report insights."}</p>
            <div class="hero-read-time-badge">${readTime} min read</div>
          </div>
          
          <div class="trending-bottom-bar">
            <div class="trending-meta">
              <a href="author.html?id=${heroStory.authorId}" class="author-pill">
                <img src="${author.avatar || 'images/authors/myprofilecircle.png'}" alt="${author.name}">
                <div class="author-info-col">
                  <div class="author-name-text">${author.name}</div>
                  <div class="author-role-text">${author.role || 'Senior Analyst'}</div>
                </div>
              </a>
              <span class="meta-sep">•</span>
              <span class="hero-date-text">${formattedDate}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Helper: Select hero story based on current filter or default trending
    function updateHeroForCategory(cat) {
      if (cat === "All") {
        let defaultHero = stories.find(s => s.isHero === true) || stories.find(s => s.trendingWeekly === true);
        if (!defaultHero && stories.length > 0) {
          defaultHero = [...stories].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
        }
        renderHeroCard(defaultHero);
      } else {
        let catStories = stories.filter(s => s.category === cat);
        if (catStories.length > 0) {
          const topCatHero = catStories.find(s => s.isHero === true) || catStories.find(s => s.trendingWeekly === true) || [...catStories].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
          renderHeroCard(topCatHero);
        } else if (stories.length > 0) {
          renderHeroCard(stories[0]);
        }
      }
    }

    // Initial Hero Render
    updateHeroForCategory("All");

    // -------------------------------------------------------
    // SECTION 2: LATEST ARTICLES (NEWEST FIRST, LIMIT 20, VIEW ALL)
    // -------------------------------------------------------
    function renderLatestArticles() {
      storiesEl.innerHTML = "";

      let filtered = stories.filter(s => {
        const matchCategory = (currentCategory === "All") || (s.category === currentCategory);
        const matchSearch = !searchQuery || 
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.about && s.about.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.tag && s.tag.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchCategory && matchSearch;
      });

      const totalMatching = filtered.length;
      const displayStories = filtered.slice(0, displayLimit);

      if (postCountBadge) {
        postCountBadge.textContent = `Showing ${displayStories.length} of ${totalMatching} reports`;
      }

      if (viewAllBtn) {
        if (displayLimit >= totalMatching) {
          viewAllBtn.textContent = `Showing All ${totalMatching} Posts`;
          viewAllBtn.style.opacity = "0.7";
        } else {
          viewAllBtn.textContent = `View All Financial Posts (${totalMatching})`;
          viewAllBtn.style.opacity = "1";
        }
      }

      if (displayStories.length === 0) {
        storiesEl.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b;">
            <p style="font-size: 16px; font-weight: 600;">No financial reports found matching your filter.</p>
          </div>
        `;
        return;
      }

      displayStories.forEach(s => {
        const author = authors[s.authorId] || { name: "Author", avatar: "images/authors/myprofilecircle.png" };
        const readTime = calculateReadingTime(s.body);
        const formattedDate = formatDateDDMonthYYYY(s.createdAt);
        const formattedViews = formatViews(s.views);
        const card = document.createElement("div");
        card.className = "story-card";

        card.innerHTML = `
          <div class="story-top-info">
            <span class="story-category-tag">${s.category || s.tag || 'News'}</span>
            <span class="story-views">👁️ ${formattedViews}</span>
          </div>
          <div class="story-title">${s.title}</div>
          <div class="story-excerpt">${s.about || ''}</div>
          <div class="story-meta">
            <span class="meta-author-link">
              <img src="${author.avatar || 'images/authors/myprofilecircle.png'}" alt="${author.name}">
              ${author.name}
            </span>
            <div class="meta-right-info">
              <span>${formattedDate}</span>
              <span>•</span>
              <span>⏱️ ${readTime}m</span>
            </div>
          </div>
        `;

        // Click Title -> Open Story
        card.querySelector('.story-title').onclick = () => location.href = `story.html?id=${s.id}`;
        
        // Click Category Tag -> Filter Category
        card.querySelector('.story-category-tag').onclick = (e) => {
          e.stopPropagation();
          currentCategory = s.category || "All";
          updateCategoryNavActive();
          updateHeroForCategory(currentCategory);
          renderLatestArticles();
        };

        // Click Author Link -> Open Author Page
        card.querySelector('.meta-author-link').onclick = (e) => {
          e.stopPropagation();
          location.href = `author.html?id=${s.authorId}`;
        };

        storiesEl.appendChild(card);
      });
    }

    // -------------------------------------------------------
    // MOBILE MENU & DRAWER TOGGLE LOGIC
    // -------------------------------------------------------
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const menuIcon = document.getElementById("menuIcon");
    const menuBackdrop = document.getElementById("menuBackdrop");
    const categoryNavWrapper = document.getElementById("categoryNavWrapper") || document.querySelector(".category-nav-wrapper");
    const drawerCloseBtn = document.getElementById("drawerCloseBtn");

    function openMobileMenu() {
      if (categoryNavWrapper) categoryNavWrapper.classList.add("is-open");
      if (menuBackdrop) menuBackdrop.classList.add("is-active");
      if (mobileMenuBtn) mobileMenuBtn.classList.add("is-active");
      if (menuIcon) menuIcon.textContent = "✕";
      document.body.classList.add("menu-open-scroll-lock");
      document.documentElement.classList.add("menu-open-scroll-lock");
    }

    function closeMobileMenu() {
      if (categoryNavWrapper) categoryNavWrapper.classList.remove("is-open");
      if (menuBackdrop) menuBackdrop.classList.remove("is-active");
      if (mobileMenuBtn) mobileMenuBtn.classList.remove("is-active");
      if (menuIcon) menuIcon.textContent = "☰";
      document.body.classList.remove("menu-open-scroll-lock");
      document.documentElement.classList.remove("menu-open-scroll-lock");
    }

    function toggleMobileMenu() {
      if (!categoryNavWrapper) return;
      if (categoryNavWrapper.classList.contains("is-open")) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMobileMenu();
      });
    }

    if (drawerCloseBtn) {
      drawerCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeMobileMenu();
      });
    }

    if (menuBackdrop) {
      menuBackdrop.addEventListener("click", () => {
        closeMobileMenu();
      });
      menuBackdrop.addEventListener("touchstart", (e) => {
        e.preventDefault();
        closeMobileMenu();
      }, { passive: false });
    }

    // Close menu when clicking or touching anywhere outside
    const handleOutsideInteraction = (e) => {
      if (categoryNavWrapper && categoryNavWrapper.classList.contains("is-open")) {
        if (!categoryNavWrapper.contains(e.target) && (!mobileMenuBtn || !mobileMenuBtn.contains(e.target))) {
          closeMobileMenu();
        }
      }
    };

    document.addEventListener("click", handleOutsideInteraction);
    document.addEventListener("touchstart", (e) => {
      if (categoryNavWrapper && categoryNavWrapper.classList.contains("is-open")) {
        if (!categoryNavWrapper.contains(e.target) && (!mobileMenuBtn || !mobileMenuBtn.contains(e.target))) {
          closeMobileMenu();
        }
      }
    }, { passive: true });

    // Build Category Nav Buttons
    const categories = ["All", "World", "Markets", "Economy", "Central Banks", "Technology", "Commodities"];
    
    function updateCategoryNavActive() {
      document.querySelectorAll(".category-nav button").forEach(btn => {
        if (btn.dataset.cat === currentCategory) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }

    categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.textContent = cat;
      btn.dataset.cat = cat;
      if (cat === "All") btn.classList.add("active");

      btn.onclick = () => {
        currentCategory = cat;
        updateCategoryNavActive();
        updateHeroForCategory(currentCategory);
        renderLatestArticles();
        closeMobileMenu();
      };
      navEl.appendChild(btn);
    });

    // View All Button Event
    if (viewAllBtn) {
      viewAllBtn.onclick = () => {
        displayLimit = 1000; // Remove limit to view all posts
        renderLatestArticles();
      };
    }

    // Search Input Event
    if (searchInputEl) {
      searchInputEl.oninput = (e) => {
        searchQuery = e.target.value;
        renderLatestArticles();
      };
    }

    renderLatestArticles();

    // -------------------------------------------------------
    // SECTION 3: TOP 10 AUTHORS
    // -------------------------------------------------------
    if (authorsGridEl) {
      authorsGridEl.innerHTML = "";
      const authorKeys = Object.keys(authors);

      // Sort authors by total articles or views
      authorKeys.sort((a, b) => {
        const countA = authorStats[a] ? authorStats[a].count : 0;
        const countB = authorStats[b] ? authorStats[b].count : 0;
        return countB - countA;
      });

      const top10Keys = authorKeys.slice(0, 10);

      top10Keys.forEach(aid => {
        const a = authors[aid];
        const stats = authorStats[aid] || { count: 0, views: 0 };
        const card = document.createElement("div");
        card.className = "author-card";

        card.innerHTML = `
          <img src="${a.avatar || 'images/authors/myprofilecircle.png'}" class="author-card-avatar" alt="${a.name}">
          <div class="author-card-name">${a.name}</div>
          <div class="author-card-role">${a.role || 'Financial Contributor'}</div>
          <div class="author-articles-count">📝 ${stats.count} Articles Published</div>
          <div class="author-card-bio">${a.bio ? a.bio.replace(/<[^>]+>/g, '') : ''}</div>
          <a href="author.html?id=${aid}" class="author-profile-link">View Profile & Articles →</a>
        `;

        authorsGridEl.appendChild(card);
      });
    }
  }

  /* =========================================================
     2. STORY PAGE (story.html)
     ========================================================= */
  const titleEl = document.getElementById("title");
  if (titleEl) {
    const id = Number(new URLSearchParams(location.search).get("id"));
    const story = stories.find(s => s.id === id) || stories[0];

    if (story) {
      const author = authors[story.authorId] || { 
        name: "Abhishek Tiwari", 
        avatar: "images/authors/myprofilecircle.png", 
        role: "Founder & Chief Editor",
        bio: "Financial writer and editor."
      };

      document.title = `${story.title} | The Finshift Order`;

      titleEl.textContent = story.title;
      
      const categoryPill = document.getElementById("categoryPill");
      if (categoryPill) categoryPill.textContent = `${story.category || 'World'} • ${story.tag || 'Report'}`;

      const viewsCount = document.getElementById("viewsCount");
      if (viewsCount) viewsCount.textContent = `👁️ ${formatViews(story.views)}`;

      const readTimeEl = document.getElementById("readTime");
      const readMinutes = calculateReadingTime(story.body);
      if (readTimeEl) readTimeEl.textContent = `⏱️ ${readMinutes} min read`;

      const authorLink = document.getElementById("authorLink");
      if (authorLink) {
        authorLink.textContent = author.name;
        authorLink.href = `author.html?id=${story.authorId}`;
      }

      const authorRole = document.getElementById("authorRole");
      if (authorRole) authorRole.textContent = author.role || "Financial Analyst";

      const dateEl = document.getElementById("date");
      if (dateEl) dateEl.textContent = story.createdAt || "Recent";

      const avatarEl = document.getElementById("authorAvatar");
      if (avatarEl) {
        avatarEl.src = author.avatar || "images/authors/myprofilecircle.png";
        avatarEl.alt = author.name;
      }

      const aboutText = document.getElementById("aboutText");
      const aboutSection = document.getElementById("aboutSection");
      if (story.about) {
        aboutText.textContent = story.about;
      } else if (aboutSection) {
        aboutSection.style.display = "none";
      }

      const contentEl = document.getElementById("content");
      if (contentEl && window.marked) {
        contentEl.innerHTML = marked.parse(story.body);
      }

      // Share button handler
      const shareBtn = document.getElementById("shareBtn");
      if (shareBtn) {
        shareBtn.onclick = () => {
          navigator.clipboard.writeText(window.location.href);
          shareBtn.textContent = "✅ Link Copied!";
          setTimeout(() => shareBtn.textContent = "🔗 Share Article", 2500);
        };
      }

      // Bottom Author Card
      const bottomAuthorName = document.getElementById("bottomAuthorName");
      if (bottomAuthorName) bottomAuthorName.textContent = author.name;

      const bottomAuthorAvatar = document.getElementById("bottomAuthorAvatar");
      if (bottomAuthorAvatar) bottomAuthorAvatar.src = author.avatar || "images/authors/myprofilecircle.png";

      const bottomAuthorRole = document.getElementById("bottomAuthorRole");
      if (bottomAuthorRole) bottomAuthorRole.textContent = author.role || "Author";

      const bottomAuthorBio = document.getElementById("bottomAuthorBio");
      if (bottomAuthorBio) bottomAuthorBio.innerHTML = author.bio || "";

      const bottomAuthorBtn = document.getElementById("bottomAuthorProfileBtn");
      if (bottomAuthorBtn) bottomAuthorBtn.href = `author.html?id=${story.authorId}`;

      // Related Stories Grid (Render 3 related stories)
      const relatedGrid = document.getElementById("relatedGrid");
      if (relatedGrid) {
        relatedGrid.innerHTML = "";
        const otherStories = stories.filter(s => s.id !== story.id).slice(0, 3);
        otherStories.forEach(rel => {
          const card = document.createElement("div");
          card.className = "related-card";
          card.innerHTML = `
            <div class="related-card-cat">${rel.category || 'News'}</div>
            <div class="related-card-title">${rel.title}</div>
            <div class="related-card-date">${rel.createdAt ? rel.createdAt.split(' ')[0] : 'Recent'}</div>
          `;
          card.querySelector('.related-card-title').onclick = () => location.href = `story.html?id=${rel.id}`;
          relatedGrid.appendChild(card);
        });
      }
    }
  }

  /* =========================================================
     3. AUTHOR PAGE (author.html)
     ========================================================= */
  const authorNameEl = document.getElementById("name");
  if (authorNameEl) {
    const id = new URLSearchParams(location.search).get("id") || "k_abhishektiwari";
    const author = authors[id] || {
      name: "Abhishek Tiwari",
      role: "Founder & Chief Markets Editor",
      bio: "Author profile details.",
      avatar: "images/authors/myprofilecircle.png"
    };

    document.title = `${author.name} | Author Profile | The Finshift Order`;

    authorNameEl.textContent = author.name;

    const roleEl = document.getElementById("role");
    if (roleEl) roleEl.textContent = author.role || "Financial Contributor";

    const bioEl = document.getElementById("bio");
    if (bioEl) bioEl.innerHTML = author.bio || "";

    const avatarEl = document.getElementById("avatar");
    if (avatarEl) avatarEl.src = author.avatar || "images/authors/myprofilecircle.png";

    // Author's published articles
    const authorStories = stories.filter(s => s.authorId === id);
    let totalAuthorViews = 0;
    authorStories.forEach(s => totalAuthorViews += (s.views || 1000));

    const articlesCountStat = document.getElementById("articlesCountStat");
    if (articlesCountStat) articlesCountStat.textContent = `Published Reports: ${authorStories.length}`;

    const totalViewsStat = document.getElementById("totalViewsStat");
    if (totalViewsStat) totalViewsStat.textContent = `Total Reads: ${formatViews(totalAuthorViews)}`;

    const authorStoriesContainer = document.getElementById("authorStories");
    if (authorStoriesContainer) {
      authorStoriesContainer.innerHTML = "";
      if (authorStories.length === 0) {
        authorStoriesContainer.innerHTML = `<p style="color: #64748b;">No articles published yet by this author.</p>`;
      } else {
        authorStories.forEach(s => {
          const card = document.createElement("div");
          card.className = "story-card";
          card.innerHTML = `
            <div class="story-top-info">
              <span class="story-category-tag">${s.category || 'Report'}</span>
              <span class="story-views">👁️ ${formatViews(s.views)}</span>
            </div>
            <div class="story-title">${s.title}</div>
            <div class="story-excerpt">${s.about || ''}</div>
            <div class="story-meta">
              <span>📅 ${s.createdAt ? s.createdAt.split(' ')[0] : 'Recent'}</span>
              <span>⏱️ ${calculateReadingTime(s.body)} min read</span>
            </div>
          `;
          card.querySelector('.story-title').onclick = () => location.href = `story.html?id=${s.id}`;
          authorStoriesContainer.appendChild(card);
        });
      }
    }
  }

  // -------------------------------------------------------
  // AUTO-HIDING SCROLLBAR ACTIVE STATE DETECTOR
  // -------------------------------------------------------
  let isScrollingTimer = null;
  window.addEventListener("scroll", () => {
    document.body.classList.add("is-scrolling");
    document.documentElement.classList.add("is-scrolling");
    if (isScrollingTimer !== null) {
      clearTimeout(isScrollingTimer);
    }
    isScrollingTimer = setTimeout(() => {
      document.body.classList.remove("is-scrolling");
      document.documentElement.classList.remove("is-scrolling");
    }, 800);
  }, { passive: true });

});
