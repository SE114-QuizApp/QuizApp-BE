import express from 'express';
const userRouter = express.Router();

import {
    createUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
    addFriend,
    unFriend,
    changePassword,
    getListRankingUsers,
    updateUserPoint
} from '../controllers/userController.js';

import {
    verifyAccessToken,
    verifyUserAuthorization,
    verifyAdmin
} from '../middlewares/authMiddleware.js';

userRouter.use(verifyAccessToken);
userRouter.get('/', getUsers);
userRouter.put('/', updateUser);
userRouter.get('/ranking', getListRankingUsers);
userRouter.put('/change-password', changePassword);
userRouter.put('/addFriend/:friendId', addFriend);
userRouter.put('/unfriend/:friendId', unFriend);
userRouter.get('/:id', getUser);
userRouter.put('/updatePoints', updateUserPoint);

userRouter.post('/', verifyAdmin, createUser);
userRouter.delete('/:id', verifyAdmin, deleteUser);

export default userRouter;
