import { Product } from "../../models/productDb.js";
import { Category } from "../../models/categoryDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

export const productsPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search || '';
        const sortOption = req.query.sort || 'newest';
        const filterOption = req.query.filter || 'all';
        
        let query = {};
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        if (filterOption === 'active') {
            query.isDeleted = false;
        } else if (filterOption === 'deleted') {
            query.isDeleted = true;
        }

        let sortCriteria = {};
        if (sortOption === 'newest') sortCriteria = { createdAt: -1 };
        else if (sortOption === 'oldest') sortCriteria = { createdAt: 1 };
        else if (sortOption === 'a-z') sortCriteria = { name: 1 };
        else if (sortOption === 'z-a') sortCriteria = { name: -1 };
        else sortCriteria = { createdAt: -1 };

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .populate('category', 'name')
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit);

        res.render('admin/products', {
            layout: 'layouts/admin-panel',
            title: 'Product Management',
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            searchQuery,
            selectedSort: sortOption,
            selectedFilter: filterOption
        });

    } catch (error) {
        next(error);
    }
};

export const getAddProductPage = async (req, res, next) => {
    try {
        // Only active categories should be selectable
        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        res.render('admin/add-product', {
            layout: 'layouts/admin-panel',
            title: 'Add New Product',
            categories
        });
    } catch (error) {
        next(error);
    }
};

export const addProduct = async (req, res, next) => {
    try {
        const { name, author, isbn, description, price, category, stock, featured, coverImageIndex, brand, highlights } = req.body;
        
        let parsedVariants = [];
        if (req.body.variants) {
            try { parsedVariants = JSON.parse(req.body.variants); } catch (e) { parsedVariants = []; }
        }

        let parsedHighlights = [];
        if (highlights) {
            try { 
                parsedHighlights = Array.isArray(highlights) ? highlights : JSON.parse(highlights); 
            } catch (e) { 
                parsedHighlights = highlights.split(',').map(h => h.trim()).filter(h => h !== ""); 
            }
        }

        if (!req.files || req.files.length < 3) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "A minimum of 3 images are required." });
        }

        const images = req.files.map(file => `/uploads/products/${file.filename}`);
        
        let coverImage = "";
        const idx = parseInt(coverImageIndex);
        if (!isNaN(idx) && idx >= 0 && idx < images.length) {
            coverImage = images[idx];
        } else if (images.length > 0) {
            coverImage = images[0]; // fallback
        }

        const newProduct = new Product({
            name,
            author,
            isbn,
            description,
            price,
            category,
            stock,
            images,
            coverImage,
            brand,
            highlights: parsedHighlights,
            featured: featured === 'true',
            variants: parsedVariants
        });

        await newProduct.save();

        res.status(STATUS_CODES.CREATED).json({ success: true, message: "Product added successfully", redirectUrl: "/admin/products" });
    } catch (error) {
        next(error);
    }
};

export const getEditProductPage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id).populate('category');
        if (!product) {
            return res.redirect('/admin/products');
        }
        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        
        res.render('admin/edit-product', {
            layout: 'layouts/admin-panel',
            title: 'Edit Product',
            product,
            categories
        });
    } catch (error) {
        next(error);
    }
};

export const editProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, author, isbn, description, price, category, stock, featured, coverImageIndex, brand, highlights } = req.body;
        
        let parsedVariants = [];
        if (req.body.variants) {
            try { parsedVariants = JSON.parse(req.body.variants); } catch (e) { parsedVariants = []; }
        }

        let parsedHighlights = [];
        if (highlights) {
            try { 
                parsedHighlights = Array.isArray(highlights) ? highlights : JSON.parse(highlights); 
            } catch (e) { 
                parsedHighlights = highlights.split(',').map(h => h.trim()).filter(h => h !== ""); 
            }
        }

        // Handle flexible key names for existingImages
        let rawExistingImages = req.body.existingImages || req.body['existingImages[]'] || [];
        let parsedExistingImages = Array.isArray(rawExistingImages) ? rawExistingImages : [rawExistingImages];
        
        // Remove empty strings if any
        parsedExistingImages = parsedExistingImages.filter(img => img && img.trim() !== "");

        const newImages = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : [];
        const totalImages = [...parsedExistingImages, ...newImages];
        
        if (totalImages.length < 3) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "A minimum of 3 images are required." });
        }
        
        let finalCoverImage = "";
        const idx = parseInt(coverImageIndex);
        if (!isNaN(idx) && idx >= 0 && idx < totalImages.length) {
            finalCoverImage = totalImages[idx];
        } else if (totalImages.length > 0) {
            finalCoverImage = totalImages[0];
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, {
            name,
            author,
            isbn,
            description,
            price,
            category,
            stock,
            images: totalImages,
            coverImage: finalCoverImage,
            brand,
            highlights: parsedHighlights,
            featured: featured === 'true',
            variants: parsedVariants
        }, { new: true });

        if (!updatedProduct) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Product not found." });
        }

        res.status(STATUS_CODES.OK).json({ success: true, message: "Product updated successfully", redirectUrl: "/admin/products" });
    } catch (error) {
        next(error);
    }
};

export const toggleProductStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action } = req.params; // delete or restore

        const isDeleted = action === 'delete';

        const product = await Product.findByIdAndUpdate(id, {
            isDeleted: isDeleted
        }, { new: true });

        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Product not found" });
        }

        res.status(STATUS_CODES.OK).json({ success: true, message: `Product ${isDeleted ? 'deleted' : 'restored'} successfully` });
    } catch (error) {
        next(error);
    }
};

export const liveProductsSearch = async (req, res, next) => {
    try {
        const searchQuery = req.query.search || '';
        let query = {};
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }
        const products = await Product.find(query).populate('category', 'name').limit(10);
        res.status(STATUS_CODES.OK).json({ success: true, products });
    } catch (error) {
        next(error);
    }
};
