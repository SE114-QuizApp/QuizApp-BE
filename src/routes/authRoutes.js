import express from 'express';
const authRouter = express.Router();

import {
    registerUser,
    loginUser,
    loginSocial,
    requestRefreshToken,
    getMe,
    userLogout,
    resetPassword
} from '../controllers/authController.js';

import {
    checkEmailExist,
    checkUserName,
    verifyAccessToken
} from '../middlewares/authMiddleware.js';

//register
authRouter.post('/checkEmail', checkEmailExist);
authRouter.post('/checkUserName', checkUserName);
authRouter.post('/register', registerUser);

authRouter.post('/login', loginUser); //login
authRouter.post('/loginSocial', loginSocial); //login
authRouter.post('/refreshToken', requestRefreshToken); //refresh token
authRouter.use(verifyAccessToken); //verify token
authRouter.get('/me', getMe); //get me
authRouter.post('/resetPassword', resetPassword); //reset password
authRouter.post('/logout/:id', userLogout); //log out

export default authRouter;
