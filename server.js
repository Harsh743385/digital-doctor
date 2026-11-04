const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const memoryStore = require('memorystore')(session);
const compression = require('compression');
const { startAutoSave } = require('./src/database/connection');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const viewRoutes = require('./src/routes/viewRoutes');
const adminFieldRoutes = require('./src/routes/adminFieldRoutes');
const adminFormRoutes = require('./src/routes/adminFormRoutes');
const formRoutes = require('./src/routes/formRoutes');
const nursingRoutes = require('./src/routes/nursingRoutes');
const doctorRoutes = require('./src/routes/doctorRoutes');
const pwaRoutes = require('./src/routes/pwaRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Core middleware
app.use((req, res, next) => {
  // Normalize Vercel serverless rewritten URL path via __path query parameter
  if (req.query && req.query.__path !== undefined) {
    req.url = '/' + req.query.__path;
    delete req.query.__path;
  }
  req.originalUrl = req.url;
  next();
});

app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static files with browser caching
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d', etag: true }));

// Session setup
app.use(session({
  cookie: { maxAge: 86400000 }, // 24 hours
  store: new memoryStore({ checkPeriod: 86400000 }),
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'presco-clinical-digital-nursing-secret-key-2026'
}));

// Global template variables middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.session?.user || null;
  res.locals.csrfToken = 'GsMZ089OL6REykHKtondnN9gl3xXeq4H7fqUUC3c';
  res.locals.currentPath = req.path;
  next();
});

// Mount Routes
app.use('/', authRoutes);
app.use('/', viewRoutes);
app.use('/', formRoutes);
app.use('/api/admin', adminFieldRoutes);
app.use('/api/admin', adminFormRoutes);

// Mount Presco Digital Nursing on both standard route and API mirror
app.use('/cms/ajax/nursing', nursingRoutes);
app.use('/api/digital-nursing', nursingRoutes);

// Mount Presco Digital Doctor on both standard route and API mirror
app.use('/cms/ajax/doctor', doctorRoutes);
app.use('/api/digital-doctor', doctorRoutes);

// Mount Presco Tab Bedside PWA
app.use('/pwa', pwaRoutes);
app.get('/tab', (req, res) => res.redirect('/cms/digital-nursing'));
app.get('/pwa', (req, res) => res.redirect('/cms/digital-nursing'));
app.get('/cms/tab', (req, res) => res.redirect('/cms/digital-nursing'));

// Error template route
app.use((req, res, next) => {
  if (req.xhr || req.path.startsWith('/api/') || req.path.startsWith('/cms/ajax/')) {
    return res.status(404).json({ success: false, msg: `Route not found: ${req.method} ${req.path}` });
  }
  res.status(404).render('error', {
    title: 'Page Not Found | Presco',
    message: `The page "${req.originalUrl}" could not be found.`
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (req.xhr || req.path.startsWith('/api/') || req.path.startsWith('/cms/ajax/')) {
    return res.status(500).json({ success: false, msg: err.message || 'Internal server error' });
  }
  res.status(500).render('error', {
    title: 'Server Error | Presco',
    message: err.message || 'An unexpected error occurred.'
  });
});

// Auto-save SQLite database periodically (only in persistent server environments)
if (!process.env.VERCEL) {
  startAutoSave(5000);
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
  ══════════════════════════════════════════════════════════════════════
  🏥 Presco Digital Nursing, Field Master & Dynamic Form Builder
  ══════════════════════════════════════════════════════════════════════
  🚀 Server running at: http://localhost:${PORT}
  📋 Das hboard:        http://localhost:${PORT}/dashboard
  ⚙️  Field Master:     http://localhost:${PORT}/admin/fields
  📝 Form Builder:     http://localhost:${PORT}/admin/forms
  💉 Digital Nursing:   http://localhost:${PORT}/cms/digital-nursing
  🔒 Login:             http://localhost:${PORT}/login (admin / admin123)
  ══════════════════════════════════════════════════════════════════════
    `);
  });
}

module.exports = app;
