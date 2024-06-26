import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import constants from '../constants/httpStatus.js';

const getUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user === null) {
            return res
                .status(constants.NOT_FOUND)
                .json({ message: 'User not found' });
        }
        delete user._doc.password;
        res.status(constants.OK).json(user);
    } catch (error) {
        res.status(constants.SERVER_ERROR).json({ message: error.message });
    }
});

const getUsers = asyncHandler(async (req, res) => {
    try {
        const users = await User.find();
        let newUsers = users.map((user) => {
            delete user._doc.password;
            return user;
        });
        res.status(constants.OK).json(newUsers);
    } catch (error) {
        res.status(constants.BAD_REQUEST).json({ message: error.message });
    }
});

const getListRankingUsers = asyncHandler(async (req, res) => {
    const users = await User.find()
        .select('userName firstName lastName avatar point')
        .lean();

    let newUsers = users.sort((a, b) => {
        return b.point - a.point;
    });
    //add a field rank to each user
    newUsers = newUsers.map((user, index) => {
        user.rank = index + 1;
        return user;
    });

    res.status(constants.OK).json(newUsers);
});

const createUser = asyncHandler(async (req, res) => {
    const { userType, userName, fullName, email, password } = req.body;
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({
        userType,
        fullName,
        userName,
        email,
        password: hashedPassword
    });

    try {
        const newUser = await user.save();
        res.status(constants.CREATE).json(newUser);
    } catch (error) {
        res.status(constants.BAD_REQUEST).json({ message: error.message });
    }
});

const updateUser = asyncHandler(async (req, res) => {
    const id = req.user._id;

    const { firstName, lastName, userName, avatar, userType } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(constants.NOT_FOUND).json(`No user with id: ${id}`);
    }

    const findUserId = await User.findById(id);
    if (!findUserId) {
        return res.status(constants.NOT_FOUND).json(`No user with id: ${id}`);
    }

    const dataUpdate = {
        firstName,
        lastName,
        userName,
        avatar:
            avatar ||
            findUserId.avatar ||
            `https://avatar.iran.liara.run/username?username=${encodeURIComponent(
                `${lastName} ${firstName}`
            )}`,
        userType
    };

    const user = await User.findByIdAndUpdate(
        id,
        { $set: dataUpdate },
        { new: true }
    );

    return res.status(constants.OK).json({ user });
});

const updateUserPoint = asyncHandler(async (req, res) => {
    const id = req.user._id;
    const { point } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(constants.NOT_FOUND).json(`No user with id: ${id}`);
    }

    if (!point || point < 0) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Point must be a positive number');
    }

    const findUserId = await User.findById(id);
    if (!findUserId) {
        return res.status(constants.NOT_FOUND).json(`No user with id: ${id}`);
    }

    const user = await User.findByIdAndUpdate(id, { point }, { new: true });

    return res.status(constants.OK).json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
    const { _id } = req.user;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(_id);
    if (!user) {
        return res.status(constants.NOT_FOUND).json({
            message: 'User not found'
        });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
        return res.status(constants.FORBIDDEN).json({
            message: 'Old password is not correct'
        });
    }

    const hashedPassword = await bcrypt.hash(newPassword + '', 10);

    await User.findByIdAndUpdate(_id, { password: hashedPassword });

    return res.json({
        message: 'Change password successfully'
    });
});

const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !User.findById(id)) {
        res.status(constants.NOT_FOUND);
        throw new Error(`No user with id: ${id}`);
    }
    try {
        await User.findByIdAndRemove(id);
        res.status(constants.OK).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(constants.SERVER_ERROR).json({ message: error.message });
    }
});

const unFriend = asyncHandler(async (req, res) => {
    const { friendId } = req.params;
    const myId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(myId) || !User.findById(myId)) {
        res.status(constants.NOT_FOUND);
        throw new Error(`No user with id: ${id}`);
    }

    if (
        !mongoose.Types.ObjectId.isValid(friendId) ||
        !User.findById(friendId)
    ) {
        res.status(constants.NOT_FOUND);
        throw new Error(`No friend user with id: ${friendId}`);
    }
    const user = await User.findById(myId);
    user.friends = user.friends.filter((item) => item.toString() !== friendId);
    await user.save();
    res.status(constants.OK).json(user);
});

const addFriend = asyncHandler(async (req, res) => {
    const { friendId } = req.params;
    const myId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(myId) || !User.findById(myId)) {
        res.status(constants.NOT_FOUND).json({
            message: `No user with id: ${id}`
        });
        throw new Error(`No user with id: ${id}`);
    }

    if (
        !mongoose.Types.ObjectId.isValid(friendId) ||
        !User.findById(friendId)
    ) {
        res.status(constants.NOT_FOUND);
        throw new Error(`No friend user with id: ${friendId}`);
    }

    const user = await User.findById(myId);

    const isExist = user.friends.find((item) => item.toString() === friendId);

    if (isExist) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Friend already exists');
    }

    user.friends.push(friendId);
    await user.save();

    return res.status(constants.OK).json(user);
});

export {
    createUser,
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    addFriend,
    unFriend,
    getListRankingUsers,
    updateUserPoint
};
