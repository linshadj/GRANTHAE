import orderDb from "../../models/orderDb.js";
import { Product } from "../../models/productDb.js";
import PDFDocument from "pdfkit";

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

    item.itemStatus = 'Cancelled';
    item.cancellationReason = reason || 'User request';

    // Subtract item cost from total amount
    order.totalAmount -= (item.quantity * item.price);
    if (order.totalAmount < 0) order.totalAmount = 0;

    // Increment stock
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

    // Check if all items are cancelled, then cancel the entire order
    const allItemsCancelledOrReturned = order.items.every(i => i.itemStatus === 'Cancelled' || i.itemStatus === 'Returned');
    if (allItemsCancelledOrReturned) {
        order.orderStatus = 'Cancelled';
    }

    await order.save();
    return order;
};

export const returnOrderItem = async (userId, orderId, itemId, reason) => {
    if (!reason) throw new Error("Return reason is mandatory.");
    
    const order = await orderDb.findOne({ _id: orderId, user: userId });
    if (!order) throw new Error("Order not found");

    if (order.orderStatus.toLowerCase() !== 'delivered') {
        throw new Error("Can only return items from delivered orders.");
    }

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found in order");

    if (item.itemStatus !== 'Delivered') {
        throw new Error("Item must be delivered to be returned.");
    }

    item.itemStatus = 'Returned';
    item.returnReason = reason;

    // Subtract item cost from total amount
    order.totalAmount -= (item.quantity * item.price);
    if (order.totalAmount < 0) order.totalAmount = 0;

    // Increment stock
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

    // Check if all items are returned/cancelled
    const allItemsCancelledOrReturned = order.items.every(i => i.itemStatus === 'Cancelled' || i.itemStatus === 'Returned');
    // If we want to change order status to Returned, we should add it to enum. Since it's not in enum, we leave it as Delivered or maybe Cancelled? We'll leave it as Delivered and let the individual items hold the Returned status.

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
            doc.font('Helvetica-Bold');
            doc.text('Total Amount:', 350, y);
            doc.text(`Rs ${order.totalAmount}`, 450, y, { width: 50, align: 'right' });
            doc.font('Helvetica');
            
            doc.end();
            
        } catch (error) {
            reject(new Error("Failed to generate PDF. Make sure pdfkit is installed (npm install pdfkit)."));
        }
    });
};
