import mongoose from 'mongoose';
// import asyncHandler from 'express-async-handler';
import constants from '../constants/httpStatus.js';
import Quiz from '../models/quizModel.js';
import Question from '../models/questionModel.js';
import Category from '../models/categoryModel.js';
import Grade from '../models/gradeModel.js';
import User from '../models/userModel.js';
import { findQuizByCreator, findQuizById } from '../services/quiz.services.js';
import { wrapRequestHandler as asyncHandler } from '../utils/asyncHandler.utils.js';

//desc   Get quiz with id
//route  GET /api/quiz/:id
//access Authenticated user
const getQuiz = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(constants.BAD_REQUEST).json({
            message: 'Invalid id'
        });
    }

    const quiz = await findQuizById(id);
    if (quiz === null) {
        return res
            .status(constants.NOT_FOUND)
            .json({ message: 'Quiz not found' });
    }

    if (quiz.isDraft) {
        return res.status(constants.BAD_REQUEST).json({
            message: 'Quiz is draft'
        });
    }

    res.status(constants.OK).json(quiz);
});

//desc   Get quizzes for discover page
//route  GET /api/quiz/discover
//access Authenticated user
const getQuizzesDiscoverPage = asyncHandler(async (req, res) => {
    const result = await Quiz.aggregate([
        { $match: { isPublic: true, isDraft: false } },
        {
            $lookup: {
                from: 'categories', // Tên của bảng category trong cơ sở dữ liệu
                localField: 'category',
                foreignField: '_id',
                as: 'category'
            }
        },
        {
            $addFields: {
                category: { $arrayElemAt: ['$category', 0] }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'creator',
                foreignField: '_id',
                as: 'creator'
            }
        },
        {
            $addFields: {
                creator: { $arrayElemAt: ['$creator', 0] }
            }
        },
        {
            $group: {
                _id: '$category.name',
                quizzes: { $push: '$$ROOT' },
                quizzesCount: { $sum: 1 }
            }
        },
        {
            $sort: { quizzesCount: -1 } // Sắp xếp giảm dần theo số lượng bài kiểm tra
        },
        {
            $limit: 6 // Giới hạn kết quả chỉ lấy 5 danh mục đầu tiên
        },
        {
            $project: {
                _id: 0,
                category_name: '$_id',
                // quizzes: 1
                quizzes: {
                    $map: {
                        input: '$quizzes',
                        as: 'quiz',
                        in: {
                            $mergeObjects: [
                                '$$quiz',
                                {
                                    creator: {
                                        userName: '$$quiz.creator.userName',
                                        firstName: '$$quiz.creator.firstName',
                                        lastName: '$$quiz.creator.lastName',
                                        avatar: '$$quiz.creator.avatar',
                                        userType: '$$quiz.creator.userType'
                                    },
                                    category: {
                                        _id: '$$quiz.category._id',
                                        name: '$$quiz.category.name'
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    ]);

    const quizzesByCategory = {};

    result.forEach((category) => {
        quizzesByCategory[category.category_name] = category.quizzes;
    });

    return res.status(200).json(quizzesByCategory);
});

//desc   Get all quizzes
//route  GET /api/quiz
//access Authenticated user
const getQuizzes = asyncHandler(async (req, res) => {
    try {
        const quizzes = await Quiz.find();
        res.status(constants.OK).json(quizzes);
    } catch (error) {
        res.status(constants.SERVER_ERROR);
        throw new Error(error);
    }
});

//desc   Get all quizzes of a teacher
//route  GET /api/quiz/teacher/:teacherId
//access Authenticated user
const getTeacherQuizzes = asyncHandler(async (req, res) => {
    const { teacherId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(constants.BAD_REQUEST).json({
            message: 'Invalid id'
        });
    }
    //find quizzes by creator and sort by date created
    const user = await User.findById(teacherId);
    if (!user) {
        return res.status(constants.NOT_FOUND).json({
            message: 'User not found'
        });
    }
    const quizzes = await findQuizByCreator(teacherId);

    res.status(constants.OK).json(quizzes);
});

//desc   Get all public quizzes
//route  GET /api/quiz/public
//access Authenticated user
const getQuizzesPublics = asyncHandler(async (req, res) => {
    const { sectionName, page, pageSize } = req.query;

    if (page === 0 || page < 0) {
        return res
            .status(constants.FORBIDDEN)
            .json({ message: 'Page must be greater than 0' });
    }

    let category;
    if (
        !sectionName ||
        sectionName === 'public' ||
        sectionName === 'all' ||
        sectionName === ''
    ) {
        category = 'public';
    } else {
        category = await Category.findOne({
            name: { $regex: new RegExp(sectionName, 'i') }
        }).lean();
    }

    const PAGE = page ? Number(page) : 1; // get the page number
    const LIMIT = pageSize && Number(pageSize) != 0 ? Number(pageSize) : 10; // limit the number of quizes per page
    const startIndex = (Number(PAGE) - 1) * LIMIT; // get the starting index of every page

    const findOptions = {
        isPublic: true,
        isDraft: false
    };
    if (category !== 'public') {
        findOptions.category = category._id;
    }
    const total = await Quiz.find({ ...findOptions }).countDocuments({});

    const quizes = await Quiz.find({ ...findOptions })
        .sort({ _id: -1 }) // sort from the newest
        .limit(LIMIT) // limit the number of quizes per page
        .skip(startIndex) // skip first <startIndex> quizes
        .populate('questionList') // populate questionList
        .populate({
            path: 'creator',
            select: ['userName', 'firstName', 'lastName', 'avatar', 'userType']
        }) // populate creator
        .populate({ path: 'grade', select: 'name' }) // populate grade
        .populate({ path: 'category', select: 'name' }); // populate category

    //reset questionIndex of each question in questionList
    quizes.map((quiz) => {
        quiz.questionList.map((question, index) => {
            question.questionIndex = index + 1;
            return question;
        });
        return quiz;
    });
    res.status(constants.OK).json({
        currentPage: Number(PAGE),
        pageSize: quizes.length,
        numberOfPages: Math.ceil(total / LIMIT),
        data: quizes
    });
});

//desc   Get all quizzes by search
//route  GET /api/quiz/search?searchQuery=...&tags=...
//access Authenticated user
const getQuizzesBySearch = asyncHandler(async (req, res) => {
    const { searchName, tags } = req.query;
    // if (!searchName || !tags) {
    //     return res.status(constants.BAD_REQUEST).json({
    //         message: 'Missing search query'
    //     });
    // }

    const searchTags = tags ? tags.split(',').map((tag) => tag.trim()) : [];
    //i -> ignore case, like ii, Ii, II
    const searchTagsRegex = searchTags.map((tag) => new RegExp(tag, 'i'));
    const name = searchName ? new RegExp(searchName, 'i') : '';

    const searchQuery = [];

    if (searchName) {
        searchQuery.push({ name });
    }
    if (tags) {
        searchQuery.push({ tags: { $in: searchTagsRegex } });
    }

    if (!searchName && !tags) {
        searchQuery.push({ name: '' });
        searchQuery.push({ tags: { $in: [] } });
    }

    const quizzes = await Quiz.find({
        isPublic: true,
        isDraft: false,
        // category: {
        //     $in: ['6549f46694e401eca9b99a08', '6549f62b6e93124e61b94307']
        // }
        // $or: [{ name }, { tags: { $in: searchTagsRegex } }]
        $and: searchQuery
    })
        .populate('questionList')
        .populate({
            path: 'creator',
            select: ['userName', 'firstName', 'lastName', 'avatar', 'userType']
        })
        .populate({ path: 'category', select: 'name' })
        .populate({ path: 'grade', select: 'name' })
        .lean();

    quizzes.map((quiz) => {
        quiz.isDraft = false;
        quiz.questionList.map((question, index) => {
            question.questionIndex = index + 1;
            return question;
        });
        return quiz;
    });

    res.status(constants.OK).json(quizzes);
});

//desc   Get draft quizzes with id
//route  GET /api/quiz/draft/:id
//access Authenticated user
export const getDraftQuizById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    let quiz = await Quiz.findById(id).lean();
    if (!quiz) {
        res.status(constants.NOT_FOUND);
        throw new Error('Quiz not found');
    }

    if (!quiz.isDraft) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Quiz is not draft');
    }

    // if (!quiz.category) {
    //     quiz.category = {
    //         _id: '',
    //         name: null
    //     };
    // }

    // if (!quiz.grade) {
    //     quiz.grade = {
    //         _id: '',
    //         name: null
    //     };
    // }

    // if (!quiz.importFrom) {
    //     quiz.importFrom = '';
    // }

    return res.status(constants.OK).json(quiz);
});

//desc   Create a draft quiz
//route  POST /api/quiz/draft
//access Authenticated user
export const createDraftQuiz = asyncHandler(async (req, res) => {
    const { name, description, isPublic, category, grade } = req.body;

    if (!name) {
        res.status(constants.FORBIDDEN);
        throw new Error('Quiz must have a name!');
    }

    const quiz = new Quiz({
        name,
        description,
        isPublic,
        creator: req.user._id
    });

    const newDraftQuiz = await quiz.save();

    res.status(constants.CREATE).json(newDraftQuiz);
});
//desc   Create a quiz
//route  POST /api/quiz
//access Authenticated user
const createQuiz = asyncHandler(async (req, res) => {
    const {
        name,
        creator,
        description,
        backgroundImage,
        isPublic,
        tags,
        numberOfQuestions,
        pointsPerQuestion,
        likesCount,
        questionList,
        category,
        grade
    } = req.body;
    // const existQuizName = await Quiz.findOne({ name, creator: creator._id });
    // if (existQuizName) {
    //     res.status(constants.UNPROCESSABLE_ENTITY);
    //     throw new Error('Quiz already exists');
    // }

    if (!name) {
        return res.status(constants.BAD_REQUEST).json({
            message: 'Name is required'
        });
    }

    if (!pointsPerQuestion) {
        return res.status(constants.BAD_REQUEST).json({
            message: 'Points per question is required'
        });
    }

    // if (questionList.length === 0) {
    //     // res.status(constants.BAD_REQUEST);
    //     // throw new Error('Question List must be not empty!');

    //     return res.status(constants.BAD_REQUEST).json({
    //         message: 'Question List must be not empty!'
    //     });
    // }

    const categoryResult = await Category.findOne({
        name: category.name
    }).lean();

    const gradeResult = await Grade.findOne({ name: grade.name }).lean();

    if (!categoryResult) {
        // res.status(constants.NOT_FOUND);
        // throw new Error('Category not found');

        return res.status(constants.NOT_FOUND).json({
            message: 'Category not found'
        });
    }
    if (!gradeResult) {
        // res.status(constants.NOT_FOUND);
        // throw new Error('Grade not found');

        return res.status(constants.NOT_FOUND).json({
            message: 'Grade not found'
        });
    }

    const quiz = new Quiz({
        name,
        creator: req.user._id,
        likesCount,
        description,
        backgroundImage,
        isPublic,
        tags,
        numberOfQuestions,
        pointsPerQuestion,
        likesCount,
        questionList: [],
        category: categoryResult._id,
        grade: gradeResult._id
        // dateCreated: new Date().toISOString()
    });

    if (questionList.length === 0) {
        quiz.isDraft = true;
    } else {
        let SavedQuestionList = questionList.map(async (item) => {
            const newQuestion = new Question({
                optionQuestion: item.optionQuestion,
                // quizId: newQuiz._id,
                creator: req.user._id,
                questionIndex: item.questionIndex,
                tags: item.tags,
                isPublic: true,
                questionType: item.questionType,
                pointType: item.pointType,
                answerTime: item.answerTime,
                backgroundImage: item.backgroundImage,
                content: item.content,
                answerList: item.answerList,
                maxCorrectAnswer: item.maxCorrectAnswer,
                correctAnswerCount: item.correctAnswerCount,
                answerCorrect: item.answerCorrect
            });
            const question = await newQuestion.save();
            return question;
        });

        await Promise.all(SavedQuestionList).then((question) => {
            question.forEach((item) => {
                quiz.questionList.push(item._id);
            });
        });

        if (quiz.numberOfQuestions !== quiz.questionList.length)
            quiz.numberOfQuestions = quiz.questionList.length;
    }

    const newQuiz = await quiz.save();

    res.status(constants.CREATE).json(newQuiz);
});

//desc   Import a quiz
//route  POST /api/quiz/import
//access Authenticated user
const importQuiz = asyncHandler(async (req, res) => {
    const { quizData, userId } = req.body;

    const {
        name,
        backgroundImage,
        description,
        creatorName,
        pointsPerQuestion,
        numberOfQuestions,
        isPublic,
        tags,
        likesCount,
        questionList,
        creatorId
    } = quizData;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(constants.NOT_FOUND).send(`No user with id: ${id}`);
    }

    const user = await User.findById(userId);

    const existQuizName = await Quiz.findOne({ name, creatorId: userId });
    if (existQuizName) {
        return res
            .status(constants.UNPROCESSABLE_ENTITY)
            .json('Quiz already exists');
    }

    const quiz = new Quiz({
        name,
        backgroundImage,
        description,
        creatorId: userId,
        creatorName: user.userName,
        sourceCreator: creatorName,
        pointsPerQuestion,
        numberOfQuestions,
        isPublic,
        tags,
        importFrom: creatorId,
        likesCount,
        questionList,
        dateCreated: new Date().toISOString()
    });

    try {
        const newQuiz = await quiz.save();
        res.status(constants.CREATE).json(newQuiz);
    } catch (error) {
        throw new Error(error);
    }
});

//desc   Update a quiz
//route  PATCH /api/quiz/:id
//access Authenticated user
const updateQuiz = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(constants.BAD_REQUEST);
        throw new Error(`Invalid id: ${id}`);
    }

    const {
        _id,
        name,
        creator,
        description,
        backgroundImage,
        isPublic,
        tags,
        numberOfQuestions,
        pointsPerQuestion,
        likesCount,
        questionList,
        category,
        grade,
        isDraft
    } = req.body;

    const QuizWithIdParam = await Quiz.findById(id).lean();
    if (!QuizWithIdParam) {
        res.status(constants.NOT_FOUND);
        throw new Error(`No quiz with id: ${id}`);
    }

    // const QuizWithIdFromBody = await Quiz.findById(_id).lean();
    // if (!QuizWithIdFromBody) {
    //     res.status(constants.NOT_FOUND);
    //     throw new Error(`No quiz with id: ${_id}`);
    // }

    // if (!name || !description || !pointsPerQuestion || !tags) {
    //     res.status(constants.FORBIDDEN);
    //     throw new Error('All fields are mandatory!');
    // }

    if (!name) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Name is required');
    }

    if (!description) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Description is required');
    }

    if (
        pointsPerQuestion === null ||
        pointsPerQuestion === undefined ||
        pointsPerQuestion === ''
    ) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Points per question is required');
    }

    if (typeof pointsPerQuestion === 'string') {
        res.status(constants.BAD_REQUEST);
        throw new Error('Points per question must be a number');
    }

    if (pointsPerQuestion === 0) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Points per question must be greater than 0');
    }

    // if (!tags) {
    //     res.status(constants.BAD_REQUEST);
    //     throw new Error('Tags is required');
    // }

    if (questionList.length === 0) {
        res.status(constants.BAD_REQUEST);
        throw new Error('Question List must be not empty');
    }

    const categoryResult = await Category.findOne({
        name: category.name
    }).lean();
    const gradeResult = await Grade.findOne({ name: grade.name }).lean();

    if (!categoryResult) {
        res.status(constants.NOT_FOUND);
        throw new Error('Category not found');
    }
    if (!gradeResult) {
        res.status(constants.NOT_FOUND);
        throw new Error('Grade not found');
    }

    const quiz = new Quiz({
        name,
        creator: creator._id,
        likesCount,
        description,
        backgroundImage,
        isPublic,
        tags,
        numberOfQuestions,
        pointsPerQuestion,
        likesCount,
        questionList: [],
        category: categoryResult._id,
        grade: gradeResult._id,
        isDraft
    });

    let SavedQuestionList = questionList.map(async (item) => {
        if (item._id !== undefined && item._id !== null && item._id !== '') {
            const question = await Question.findByIdAndUpdate(item._id, item);
            return question;
        } else {
            const newQuestion = new Question({
                optionQuestion: item.optionQuestion,
                creator: creator._id,
                questionIndex: item.questionIndex,
                tags: item.tags,
                isPublic: true,
                questionType: item.questionType,
                pointType: item.pointType,
                answerTime: item.answerTime,
                backgroundImage: item.backgroundImage,
                content: item.content,
                answerList: item.answerList,
                maxCorrectAnswer: item.maxCorrectAnswer,
                correctAnswerCount: item.correctAnswerCount,
                answerCorrect: item.answerCorrect
            });

            const question = await newQuestion.save();
            return question;
        }
    });

    await Promise.all(SavedQuestionList).then((question) => {
        question.forEach((item) => {
            quiz.questionList.push(item._id);
        });
    });
    quiz._id = id;
    if (quiz.numberOfQuestions !== quiz.questionList.length)
        quiz.numberOfQuestions = quiz.questionList.length;

    // quiz.isDraft = quiz.questionList.length === 0 ? true : false;

    const updatedQuiz = await Quiz.findByIdAndUpdate(id, quiz, {
        new: true
    });
    res.status(constants.OK).json(updatedQuiz);
});

//desc   Delete a quiz
//route  DELETE /api/quiz/:id
//access Authenticated user
const deleteQuiz = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const req_user = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(constants.NOT_FOUND).json(`No quiz with id: ${id}`);
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return res.status(constants.NOT_FOUND).json(`No quiz with id: ${id}`);
    }
    // console.log(req_user.toString(), quiz.creator._id.toString());

    if (req_user.toString() !== quiz.creator._id.toString()) {
        return res
            .status(constants.FORBIDDEN)
            .json('You can only delete your quiz');
    }

    await Question.deleteMany({ _id: { $in: quiz.questionList } });

    await Quiz.findByIdAndRemove(id);
    res.status(constants.OK).json({
        message: 'Quiz deleted succesfully'
    });
});

const likeQuiz = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(constants.NOT_FOUND).send(`No quiz with id: ${id}`);
    }

    try {
        const quiz = await Quiz.findById(id);
        const index = quiz.likesCount.findIndex(
            (id) => id === String(req.user.id)
        );
        if (index === -1) {
            quiz.likesCount.push(req.user.id);
        } else {
            quiz.likesCount = quiz.likesCount.filter(
                (id) => id !== String(req.user.id)
            );
        }
        const updatedQuiz = await Quiz.findByIdAndUpdate(id, quiz, {
            new: true
        });
        res.json(updatedQuiz);
    } catch (error) {
        res.status(constants.SERVER_ERROR).json({ message: error.message });
    }
});

const commentQuiz = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    try {
        const quiz = await Quiz.findById(id);
        quiz.comments.push(comment);
        const updatedQuiz = await Quiz.findByIdAndUpdate(id, quiz, {
            new: true
        });
        res.status(constants.OK).json(updatedQuiz);
    } catch (error) {
        res.status(constants.SERVER_ERROR).json({ message: error.message });
    }
});

export {
    getQuiz,
    getQuizzes,
    getQuizzesDiscoverPage,
    getTeacherQuizzes,
    getQuizzesPublics,
    getQuizzesBySearch,
    createQuiz,
    importQuiz,
    updateQuiz,
    deleteQuiz,
    likeQuiz,
    commentQuiz
};
