import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        name: { type: String },

        image: { type: String },

        message: { type: String },

        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        to: { type: String }
    },

    {
        timestamps: true
    }
);

const Message = mongoose.model('Message', messageSchema);
export default Message;
