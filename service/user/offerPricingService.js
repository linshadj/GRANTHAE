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

export const getBestOfferForProduct = async (product, basePrice = product.price) => {
    const price = roundCurrency(basePrice);
    const offers = await getActiveOffersForProduct(product);
    let best = null;

    for (const offer of offers) {
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

export const applyOfferToProductObject = async (product) => {
    const productObject = typeof product.toObject === "function" ? product.toObject() : { ...product };
    const offer = await getBestOfferForProduct(productObject, productObject.price);
    const variants = Array.isArray(productObject.variants)
        ? await Promise.all(productObject.variants.map(async (variant) => {
            const variantObject = typeof variant.toObject === "function" ? variant.toObject() : { ...variant };
            const basePrice = roundCurrency(variantObject.priceOverride || productObject.price);
            const variantOffer = await getBestOfferForProduct(productObject, basePrice);
            return {
                ...variantObject,
                basePrice,
                offerPrice: variantOffer.finalPrice,
                offerDiscountAmount: variantOffer.discountAmount,
                offerTitle: variantOffer.title,
                hasOffer: variantOffer.discountAmount > 0,
            };
        }))
        : [];

    return {
        ...productObject,
        variants,
        originalPrice: roundCurrency(productObject.price),
        offerPrice: offer.finalPrice,
        offerDiscountAmount: offer.discountAmount,
        bestOffer: offer.title ? offer : null,
        hasOffer: offer.discountAmount > 0,
    };
};

export const applyOffersToProductObjects = async (products) => {
    return Promise.all(products.map((product) => applyOfferToProductObject(product)));
};
