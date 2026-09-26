# VAG Performance

Website for VAG Performance car service ([euro-performance.kz](https://euro-performance.kz)) with an admin panel for content management.

## Tech Stack

- HTML, CSS, vanilla JavaScript
- Firebase Authentication (admin login)
- Cloud Firestore (all site content)
- Hosting: ps.kz

**Website**
- Dark premium design with animations
- All content loaded dynamically from Firestore
- Sections: services, why us, gallery, reviews, blog, online booking
- WhatsApp contact redirect
- Fully responsive layout

**Admin Panel** (`admin.html`)
- Firebase-based authentication
- Full CRUD for services, reviews, gallery photos, blog articles, and the "Why Us" section

## Structure

index.html main page
admin.html admin panel
script.js site logic
admin.js admin panel logic
*.css per-section styles (hero, services, gallery, blog, etc.)
responsive.css responsive styles


## Setup

1. Upload the files to your hosting (or serve locally with any static server).
2. In Firebase Console → Authentication → Settings → Authorized domains, add your site's domain.
3. Log in at `admin.html` with the admin account and fill in the content.


## Author

Dilan Abkanov · [GitHub](https://github.com/wAnekz)
