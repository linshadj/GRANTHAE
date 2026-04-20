import { Category } from "../../models/categoryDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

// Categories page
export const categoriesPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search || '';
        const sortOption = req.query.sort || 'newest';
        
        let query = {};
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        let sortCriteria = {};
        if (sortOption === 'newest') sortCriteria = { createdAt: -1 };
        else if (sortOption === 'oldest') sortCriteria = { createdAt: 1 };
        else if (sortOption === 'a-z') sortCriteria = { name: 1 };
        else if (sortOption === 'z-a') sortCriteria = { name: -1 };
        else sortCriteria = { createdAt: -1 };

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        const categories = await Category.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

        res.render('admin/categories', {
            layout: 'layouts/admin-panel',
            title: 'Category Management',
            categories,
            currentPage: page,
            totalPages,
            totalCategories,
            searchQuery,
            selectedSort: sortOption
        });

    } catch (error) {
        next(error);
    }
};

export const getAddCategoryPage = async (req, res, next) => {
    try {
        res.render('admin/add-category', {
            layout: 'layouts/admin-panel',
            title: 'Add New Category'
        });
    } catch (error) {
        next(error);
    }
};

export const addCategory = async (req, res, next) => {
    try {
        const { name, slug, description, featured, active } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Category name is required" });
        }
        if (!slug || slug.trim() === '') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Slug is required" });
        }

        const existingName = await Category.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
        if (existingName) {
            return res.status(STATUS_CODES.CONFLICT).json({ success: false, message: "Category name already exists" });
        }

        const existingSlug = await Category.findOne({ slug: slug.trim().toLowerCase() });
        if (existingSlug) {
            return res.status(STATUS_CODES.CONFLICT).json({ success: false, message: "Slug already exists" });
        }

        const coverImage = req.file ? `/uploads/categories/${req.file.filename}` : "";

        const newCategory = new Category({
            name: name.trim(),
            slug: slug.trim().toLowerCase(),
            description: description ? description.trim() : '',
            isFeatured: featured === 'true',
            isBlocked: active === 'false',
            coverImage
        });

        await newCategory.save();
        
        res.status(STATUS_CODES.CREATED).json({ success: true, message: "Category added successfully", redirectUrl: "/admin/categories" });
    } catch (error) {
        next(error);
    }
};

export const getEditCategoryPage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        if (!category) {
            return res.redirect('/admin/categories');
        }
        res.render('admin/edit-category', {
            layout: 'layouts/admin-panel',
            title: 'Edit Category',
            category
        });
    } catch (error) {
        next(error);
    }
};

export const editCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, slug, description, featured, active } = req.body;

        if (!name || name.trim() === '') {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "Category name is required" });
        }

        const existingName = await Category.findOne({ 
            name: { $regex: new RegExp('^' + name.trim() + '$', 'i') }, 
            _id: { $ne: id } 
        });
        if (existingName) {
            return res.status(STATUS_CODES.CONFLICT).json({ success: false, message: "Another category with this name already exists" });
        }

        const existingSlug = await Category.findOne({ 
            slug: slug.trim().toLowerCase(), 
            _id: { $ne: id } 
        });
        if (existingSlug) {
            return res.status(STATUS_CODES.CONFLICT).json({ success: false, message: "Slug already exists" });
        }

        const updateData = {
            name: name.trim(),
            slug: slug.trim().toLowerCase(),
            description: description ? description.trim() : '',
            isFeatured: featured === 'true',
            isBlocked: active === 'false'
        };

        if (req.file) {
            updateData.coverImage = `/uploads/categories/${req.file.filename}`;
        }

        const category = await Category.findByIdAndUpdate(id, updateData, { new: true });

        if (!category) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Category not found" });
        }

        res.status(STATUS_CODES.OK).json({ success: true, message: "Category updated successfully", redirectUrl: "/admin/categories" });
    } catch (error) {
        next(error);
    }
};

export const toggleCategoryStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.params; // delete or restore

        const isDeleted = action === 'delete';

        const category = await Category.findByIdAndUpdate(id, {
            isDeleted: isDeleted
        }, { new: true });

        if (!category) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Category not found" });
        }

        res.status(STATUS_CODES.OK).json({ success: true, message: `Category ${isDeleted ? 'deleted' : 'restored'} successfully` });
    } catch (error) {
        next(error);
    }
};

export const liveCategoriesSearch = async (req, res, next) => {
    try {
        const searchQuery = req.query.search || '';
        const sortOption = req.query.sort || 'newest';
        
        let query = {};
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        let sortCriteria = {};
        if (sortOption === 'newest') sortCriteria = { createdAt: -1 };
        else if (sortOption === 'oldest') sortCriteria = { createdAt: 1 };
        else if (sortOption === 'a-z') sortCriteria = { name: 1 };
        else if (sortOption === 'z-a') sortCriteria = { name: -1 };
        else sortCriteria = { createdAt: -1 };

        const categories = await Category.find(query).sort(sortCriteria); // for a simple search maybe limit is good, but pagination overrides it on front

        res.status(STATUS_CODES.OK).json({ success: true, categories });
    } catch (error) {
        next(error);
    }
};
