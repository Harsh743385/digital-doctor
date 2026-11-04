const bcrypt = require('bcryptjs');
const { queryOne, run } = require('../database/connection');

async function showLogin(req, res) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Sign In | Presco Digital Nursing',
    error: null,
    returnTo: req.query.returnTo || ''
  });
}

async function login(req, res) {
  const { username, password, returnTo } = req.body;

  if (!username || !password) {
    return res.render('login', {
      title: 'Sign In | Presco Digital Nursing',
      error: 'Please enter both username and password.',
      returnTo
    });
  }

  try {
    const user = await queryOne('SELECT * FROM users WHERE username = ? AND is_active = 1', [username.trim()]);
    if (!user) {
      return res.render('login', {
        title: 'Sign In | Presco Digital Nursing',
        error: 'Invalid username or password.',
        returnTo
      });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.render('login', {
        title: 'Sign In | Presco Digital Nursing',
        error: 'Invalid username or password.',
        returnTo
      });
    }

    // Set session user (exclude password hash)
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      hospital_id: user.hospital_id
    };

    const dest = returnTo || req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    return res.redirect(dest);
  } catch (err) {
    console.error('Login error:', err);
    return res.render('login', {
      title: 'Sign In | Presco Digital Nursing',
      error: `Login failed: ${err.message || 'An unexpected error occurred. Please try again.'}`,
      returnTo
    });
  }
}

async function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

async function getCurrentUser(req, res) {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ success: false, msg: 'Not logged in' });
}

module.exports = {
  showLogin,
  login,
  logout,
  getCurrentUser
};
