import { Offer } from "../../models/offerDb.js";

const roundCurrency = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const toIdString = (value) => {
    if (!value) return "";
    if (value._id) return value._id.toString();
    return value.toString();
};

const calculateDiscountAmount = (offer, price) => {
    const normalizedPrice = Number(price || 0);
    if (normalizedPrice <= 0) return 0;

    const rawDiscount = offer.discountType === "percentage"
        ? normalizedPrice * (Number(offer.discountValue || 0) / 100)
        : Number(offer.discountValue || 0);

    return roundCurrency(Math.min(Math.max(rawDiscount, 0), normalizedPrice));
};

const getActiveOffers = async () => {
    const now = new Date();

    return Offer.find({
        isDeleted: false,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
    });
};

const offerAppliesToProduct = (offer, product) => {
    if (offer.appliesTo === "all") return true;

    const productId = toIdString(product);
    const categoryId = toIdString(product.category);

    if (offer.appliesTo === "products") {
        return Array.isArray(offer.products) && offer.products.some((id) => toIdString(id) === productId);
    }

    if (offer.appliesTo === "categories") {
        return categoryId && Array.isArray(offer.categories) && offer.categories.some((id) => toIdString(id) === categoryId);
    }

    return false;
};

export const getActiveOffersForProduct = async (product) => {
    const now = new Date();
    const productId = toIdString(product);
    const categoryId = toIdString(product.category);

    const offerConditions = [
        { appliesTo: "all" },
        { appliesTo: "products", products: productId },
    ];

    if (categoryId) {
        offerConditions.push({ appliesTo: "categories", categories: categoryId });
    }

    return Offer.find({
        isDeleted: false,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: offerConditions,
    });
};

const getBestOfferFromOffers = (product, basePrice, offers = []) => {
    const price = roundCurrency(basePrice);
    let best = null;

    for (const offer of offers) {
        if (!offerAppliesToProduct(offer, product)) continue;

        const discountAmount = calculateDiscountAmount(offer, price);
        if (discountAmount <= 0) continue;

        if (!best || discountAmount > best.discountAmount) {
            best = {
                title: offer.title,
                discountType: offer.discountType,
                discountValue: offer.discountValue,
                appliesTo: offer.appliesTo,
                discountAmount,
                finalPrice: roundCurrency(price - discountAmount),
            };
        }
    }

    return best || {
        title: "",
        discountType: "",
        discountValue: 0,
        appliesTo: "",
        discountAmount: 0,
        finalPrice: price,
    };
};

export const getBestOfferForProduct = async (product, basePrice = product.price) => {
    const price = roundCurrency(basePrice);
    const offers = await getActiveOffersForProduct(product);
    return getBestOfferFromOffers(product, price, offers);
};

export const applyOfferToProductObject = async (product, activeOffers = null) => {
    const productObject = typeof product.toObject === "function" ? product.toObject() : { ...product };
    const offers = activeOffers || await getActiveOffersForProduct(productObject);
    const offer = getBestOfferFromOffers(productObject, productObject.price, offers);
    const variants = Array.isArray(productObject.variants)
        ? productObject.variants.map((variant) => {
            const variantObject = typeof variant.toObject === "function" ? variant.toObject() : { ...variant };
            const basePrice = roundCurrency(variantObject.priceOverride || productObject.price);
            const variantOffer = getBestOfferFromOffers(productObject, basePrice, offers);
            return {
                ...variantObject,
                basePrice,
                offerPrice: variantOffer.finalPrice,
                offerDiscountAmount: variantOffer.discountAmount,
                offerTitle: variantOffer.title,
                hasOffer: variantOffer.discountAmount > 0,
            };
        })
        : [];

    return {
        ...productObject,
        variants,
        originalPrice: roundCurrency(productObject.price),
        offerPrice: offer.finalPrice,
        effectivePrice: offer.finalPrice,
        offerDiscountAmount: offer.discountAmount,
        bestOffer: offer.title ? offer : null,
        hasOffer: offer.discountAmount > 0,
    };
};

export const applyOffersToProductObjects = async (products) => {
    const activeOffers = await getActiveOffers();
    return Promise.all(products.map((product) => applyOfferToProductObject(product, activeOffers)));
};
