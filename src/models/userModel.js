import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    mail: {
        type: String,
        required: true
    },

    userName: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 30
    },

    firstName: {
        minlength: 2,
        maxlength: 10,
        type: String
    },

    lastName: {
        minlength: 2,
        maxlength: 10,
        type: String
    },

    avatar: {
        type: String
    },

    userType: {
        type: String,
        enum: ['Student', 'Teacher', 'Admin'],
        default: 'Student',
        required: true
    },

    password: {
        type: String
    },

    point: {
        type: Number
    },

    follows: {
        type: [String]
    },

    friends: {
        type: [String]
    },

    emailToken: {
        type: String
    },

    isVerified: {
        type: Boolean
    }
});

const User = mongoose.model('User', userSchema);
export default User;
