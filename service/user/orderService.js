import orderDb from "../../models/orderDb.js";
import { Product } from "../../models/productDb.js";
import { creditWallet } from "./walletService.js";
import PDFDocument from "pdfkit";

const roundCurrency = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const isPaidOrder = (order) => order.paymentStatus === 'Success' || order.paymentMethod === 'Wallet';

const getActiveItemsSubtotal = (order) => {
    return roundCurrency(order.items.reduce((total, item) => {
        if (item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') return total;
        return total + (Number(item.price || 0) * Number(item.quantity || 0));
    }, 0));
};

const calculateItemRefundAmount = (order, item) => {
    const itemAmount = roundCurrency(Number(item.price || 0) * Number(item.quantity || 0));
    const activeSubtotal = getActiveItemsSubtotal(order);

    if (activeSubtotal <= 0) return 0;
    const refundShare = itemAmount / activeSubtotal;
    return roundCurrency(Math.min(itemAmount, Number(order.totalAmount || 0) * refundShare));
};

const applyFinancialAdjustment = (order, item, refundAmount, trackRefund = true) => {
    const itemAmount = Number(item.price || 0) * Number(item.quantity || 0);

    order.subtotalAmount = Math.max(0, roundCurrency(Number(order.subtotalAmount || 0) - itemAmount));
    order.totalAmount = Math.max(0, roundCurrency(Number(order.totalAmount || 0) - refundAmount));
    if (trackRefund) {
        order.refundedAmount = roundCurrency(Number(order.refundedAmount || 0) + refundAmount);
    }
};

const refundItemToWallet = async (order, item, reason, precomputedRefundAmount = null) => {
    if (!isPaidOrder(order) || item.refundStatus === 'Completed') return 0;

    const refundAmount = precomputedRefundAmount === null
        ? calculateItemRefundAmount(order, item)
        : roundCurrency(precomputedRefundAmount);
    if (refundAmount <= 0) {
        item.refundAmount = 0;
        item.refundStatus = 'None';
        applyFinancialAdjustment(order, item, 0, false);
        return 0;
    }

    await creditWallet(
        order.user,
        refundAmount,
        `${reason} refund for order ${order.orderID}`,
        "order_refund",
        `${order._id}:${item._id}`
    );

    item.refundAmount = refundAmount;
    item.refundStatus = 'Completed';
    item.refundedAt = new Date();
    applyFinancialAdjustment(order, item, refundAmount, true);

    const refundableItemsRemaining = order.items.some((orderItem) => {
        if (orderItem._id.toString() === item._id.toString()) return false;
        return orderItem.itemStatus !== 'Cancelled' && orderItem.itemStatus !== 'Returned';
    });

    if (!refundableItemsRemaining && order.totalAmount === 0) {
        order.paymentStatus = 'Refunded';
    }

    return refundAmount;
};

export const getUserOrders = async (userId, searchQuery = '') => {
    let query = { user: userId };
    
    if (searchQuery) {
        query.orderID = { $regex: searchQuery, $options: 'i' };
    }

    const orders = await orderDb.find(query)
        .populate('items.product')
        .sort({ createdAt: -1 });
    
    return orders;
};

export const getOrderById = async (userId, orderId) => {
    const order = await orderDb.findOne({ _id: orderId, user: userId })
        .populate('items.product');
    
    if (!order) throw new Error("Order not found");
    return order;
};

export const cancelOrderItem = async (userId, orderId, itemId, reason) => {
    if (!reason || !reason.trim()) throw new Error("Cancellation reason is mandatory.");

    const order = await orderDb.findOne({ _id: orderId, user: userId });
    if (!order) throw new Error("Order not found");

    if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') {
        throw new Error("Cannot cancel an item in a Delivered or Cancelled order.");
    }

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found in order");

    if (item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') {
        throw new Error("Item is already cancelled or returned.");
    }

    const refundAmount = calculateItemRefundAmount(order, item);
    item.itemStatus = 'Cancelled';
    item.cancellationReason = reason.trim();

    if (order.stockAdjusted !== false) {
        if (item.variant) {
            await Product.updateOne(
                { _id: item.product, "variants.name": item.variant },
                { $inc: { "variants.$.stock": item.quantity } }
            );
        } else {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { stock: item.quantity } }
            );
        }
    }

    if (isPaidOrder(order)) {
        await refundItemToWallet(order, item, 'Cancellation', refundAmount);
    } else {
        item.refundAmount = 0;
        item.refundStatus = 'None';
        applyFinancialAdjustment(order, item, refundAmount, false);
    }

    // Check if all items are cancelled, then cancel the entire order
    const allItemsCancelledOrReturned = order.items.every(i => i.itemStatus === 'Cancelled' || i.itemStatus === 'Returned');
    if (allItemsCancelledOrReturned) {
        order.orderStatus = 'Cancelled';
    }

    await order.save();
    return order;
};

export const returnOrderItem = async (userId, orderId, itemId, reason) => {
    if (!reason || !reason.trim()) throw new Error("Return reason is mandatory.");
    
    const order = await orderDb.findOne({ _id: orderId, user: userId });
    if (!order) throw new Error("Order not found");

    if (order.orderStatus.toLowerCase() !== 'delivered') {
        throw new Error("Can only return items from delivered orders.");
    }

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found in order");

    if (item.itemStatus === 'Return Requested') {
        throw new Error("Return request is already pending.");
    }

    if (item.itemStatus !== 'Delivered') {
        throw new Error("Item must be delivered to be returned.");
    }

    item.itemStatus = 'Return Requested';
    item.returnReason = reason.trim();
    item.returnRequestStatus = 'Pending';
    item.returnRequestedAt = new Date();
    item.refundStatus = isPaidOrder(order) ? 'Pending' : 'None';

    await order.save();
    return order;
};

export const generateInvoicePDF = async (userId, orderId) => {
    const order = await orderDb.findOne({ _id: orderId, user: userId }).populate('items.product');
    
    if (!order) throw new Error("Order not found");
    if (order.orderStatus !== 'Delivered') throw new Error("Invoice is only available for delivered orders");

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Header
            doc.fontSize(20).text('GRANTHAE.', { align: 'center' });
            doc.fontSize(12).text('Premium Bookstore', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(16).text('TAX INVOICE', { align: 'center' });
            doc.moveDown();

            // Order Data
            doc.fontSize(10).text(`Order ID: ${order.orderID}`);
            doc.text(`Date: ${order.updatedAt.toDateString()}`);
            doc.text(`Status: ${order.orderStatus}`);
            doc.moveDown();

            // Billing Address
            const sa = order.shippingAddress;
            doc.text('Billed To:');
            doc.text(`${sa.firstName} ${sa.lastName}`);
            doc.text(`${sa.streetAddress}, ${sa.city}`);
            doc.text(`${sa.state}, ${sa.country} - ${sa.pinCode}`);
            doc.text(`Phone: ${sa.phoneNumber}`);
            doc.moveDown();

            // Items Table Header
            const tableTop = doc.y;
            doc.font('Helvetica-Bold');
            doc.text('Item', 50, tableTop);
            doc.text('Qty', 350, tableTop, { width: 50, align: 'right' });
            doc.text('Price', 400, tableTop, { width: 50, align: 'right' });
            doc.text('Total', 450, tableTop, { width: 50, align: 'right' });
            
            doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
            doc.font('Helvetica');

            let y = tableTop + 25;
            order.items.forEach(item => {
                const productName = item.product ? item.product.name : 'Unknown Product';
                doc.text(productName, 50, y, { width: 300 });
                doc.text(item.quantity.toString(), 350, y, { width: 50, align: 'right' });
                doc.text(`Rs ${item.price}`, 400, y, { width: 50, align: 'right' });
                doc.text(`Rs ${item.quantity * item.price}`, 450, y, { width: 50, align: 'right' });
                
                let maxY = doc.y;
                if (item.variant) {
                    doc.fontSize(8).fillColor('gray').text(`Variant: ${item.variant}`, 50, y + 12);
                    doc.fontSize(10).fillColor('black');
                    maxY += 12;
                }
                
                if (item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') {
                    doc.fontSize(8).fillColor('red').text(`(${item.itemStatus})`, 50, maxY + 2);
                    doc.fontSize(10).fillColor('black');
                    maxY += 12;
                }

                y = maxY + 15;
            });

            doc.moveTo(50, y).lineTo(500, y).stroke();
            y += 15;

            // Total
            const subtotal = order.subtotalAmount || (order.totalAmount + (order.discountAmount || 0));
            doc.font('Helvetica-Bold');
            doc.text('Subtotal:', 350, y);
            doc.text(`Rs ${subtotal}`, 450, y, { width: 50, align: 'right' });
            if (order.discountAmount && order.discountAmount > 0) {
                y += 18;
                doc.text(`Coupon Discount${order.couponCode ? ` (${order.couponCode})` : ''}:`, 300, y, { width: 150, align: 'right' });
                doc.text(`-Rs ${order.discountAmount}`, 450, y, { width: 50, align: 'right' });
            }
            y += 18;
            doc.text('Total Amount:', 350, y);
            doc.text(`Rs ${order.totalAmount}`, 450, y, { width: 50, align: 'right' });
            doc.font('Helvetica');
            
            doc.end();
            
        } catch (error) {
            reject(new Error("Failed to generate PDF. Make sure pdfkit is installed (npm install pdfkit)."));
        }
    });
};
