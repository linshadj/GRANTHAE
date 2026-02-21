import passport from 'passport';

// This starts the Google process
export const googleAuth = passport.authenticate('google', { 
    scope: ['profile', 'email'] 
});

// This handles the return from Google
export const googleAuthCallbackMiddleware = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    
    if (err) {
      return res.redirect('/sign-in?status=error&message=Something went wrong');
    }

    if (!user) {
      const message = info?.message || "Authentication failed";
      return res.redirect(`/sign-in?status=error&message=${encodeURIComponent(message)}`);
    }

    req.logIn(user, (err) => {
      if (err) {
        return res.redirect('/sign-in?status=error&message=Login failed');
      }
      return next();
    });

  })(req, res, next);
};


// This is your final custom logic (Session management)
export const googleAuthSuccess = (req, res) => {
    req.session.user = req.user._id;
    req.session.isAuth = true;
    res.redirect('/home');
};