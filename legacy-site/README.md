# The Throne of Wisdom — Website

## 🌟 Overview
A state-of-the-art website for **The Throne of Wisdom** — Holistic Mental Wellbeing Counsellor. Meditation & awareness-based healing.

## 📄 Pages

### `index.html` — Main Website
A single-page application with smooth-scrolling sections:
- **Hero** — Animated landing with floating particles, mandala patterns, and glowing effects
- **About** — Story, philosophy, and stats
- **Services** — 1:1 Counselling, Guided Meditation, Awareness-Based Healing, Group Meditations, Homeschooling Guidance, Writings
- **Homeschooling** — Comprehensive guide covering legal status, certification pathways (NIOS, Cambridge, Pearson Edexcel, US K-12), curriculum options, and university admission
- **Writings** — Blog section with category filters and article modal viewer
- **Flyer** — Section for the promotional flyer/poster
- **Testimonials** — Client stories
- **Community** — Links to Telegram, Instagram, YouTube, Group Chat
- **Contact** — Booking form + social links

### `blog.html` — Article Management
A full article management system where your wife can:
- ✍️ **Add new articles** — Click "Add New Article" button
- 📋 **Copy-paste content** — Simply paste writings into the content area
- 🏷️ **Categorize** — Meditation, Healing, Awareness, Homeschooling
- 👁️ **Preview & read** — Expand articles in-place
- 💾 **Auto-saves** — Articles persist in browser localStorage

## 🔗 Social Links Integrated
- **Telegram**: https://t.me/+LMeBJBZBDBcxODY1
- **Instagram**: https://www.instagram.com/thethroneofwisdom/
- **YouTube**: https://youtube.com/@the.throneofwisdom
- **Group Chat**: https://ig.me/j/AbaHJBaUQDgFH-KK/

## 📸 Flyer/Image
Place your `Flyer.jpeg` file in the `throneofwisdom/` folder. The website will automatically detect and display it in the Flyer section.

## 🎨 Design Features
- Deep purple & gold color scheme (spiritual, regal aesthetic)
- Animated mandala SVG patterns
- Floating golden particles in the hero
- Scroll-reveal animations on all sections
- Counter animations for stats
- Smooth scrolling navigation
- Active nav link highlighting
- Mobile-responsive with hamburger menu
- Loading screen with spinning mandala
- Back-to-top button
- Category-based blog filtering
- Article modal reader
- Form with submission feedback

## 📱 Mobile Responsive
The website is fully responsive and works beautifully on:
- Desktop (1400px+)
- Laptop (1024px+)
- Tablet (768px+)
- Mobile (below 768px)

## 🚀 How to Use

### Adding New Articles
1. Open `blog.html` in a browser
2. Click the "✎ Add New Article" button
3. Fill in the title, category, excerpt, and paste your content
4. Click "Publish Article ✦"
5. Articles are saved in your browser's localStorage

### Deploying Online
This is a static website — you can host it on:
- **Netlify** (free) — drag and drop the folder
- **Vercel** (free) — connect your GitHub repo
- **GitHub Pages** (free) — push to a GitHub repo
- **Custom hosting** — upload via FTP

### Adding the Flyer
Simply place `Flyer.jpeg` in the `throneofwisdom/` folder alongside the HTML files.

## ⚡ Technical Notes
- Pure HTML/CSS/JS — no frameworks or build tools needed
- Google Fonts loaded (Cormorant Garamond, Inter, Playfair Display)
- All animations are CSS-based (no external animation libraries)
- Blog articles stored in localStorage (for persistent demo; upgrade to a CMS for production)
- SVG mandalas are inline (no external images needed)
- For production, consider adding a proper backend/CMS for article management
