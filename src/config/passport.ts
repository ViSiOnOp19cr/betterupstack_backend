import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import prisma from '../lib/db';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../lib/config';



passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/v1/auth/google/callback',
    },
    async (
      accessToken: string, 
      refreshToken: string, 
      profile: Profile, 
      done: (error: any, user?: any | false | null) => void
    ) => {
      try {
        console.log('Google OAuth callback received for user:', profile.id);
        
        let user = await prisma.user.findUnique({
          where: { google_id: profile.id }
        });

        if (user) {
          console.log('Existing Google user found:', user.id);
          return done(null, user);
        }

        const email = profile.emails?.[0]?.value;
        
        if (email) {
          const existingEmailUser = await prisma.user.findUnique({
            where: { email }
          });

          if (existingEmailUser) {
            console.log('Linking Google account to existing user:', existingEmailUser.id);
            user = await prisma.user.update({
              where: { id: existingEmailUser.id },
              data: {
                google_id: profile.id,
                name: profile.displayName || null,
                picture: profile.photos?.[0]?.value || null,
                auth_provider: 'google'
              }
            });
            return done(null, user);
          }
        }

        console.log('Creating new Google user');
        user = await prisma.user.create({
          data: {
            google_id: profile.id,
            email: email || null,
            name: profile.displayName || null,
            picture: profile.photos?.[0]?.value || null,
            auth_provider: 'google'
          }
        });

        console.log('New Google user created:', user.id);
        done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user: any, done: (err: any, id?: string) => void) => {

  done(null, user.id);
});

passport.deserializeUser(async (id: string, done: (err: any, user?: Express.User | null) => void) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id } 
    });
    done(null, user);
  } catch (error) {
    console.error('Passport deserialize error:', error);
    done(error, null);
  }
});

export default passport;