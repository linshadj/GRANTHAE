import * as rentalRequestService from "../../service/admin/rentalRequestService.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

export const getRentalRequestsPage = async (req, res, next) => {
    try {
        const result = await rentalRequestService.getAllRentalRequests(req.query);
        res.render('admin/rental-requests', {
            layout: 'layouts/admin-panel',
            title: 'Rental Requests',
            requests: result.requests,
            total: result.total,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            selectedStatus: req.query.status || 'all'
        });
    } catch (error) {
        next(error);
    }
};

export const handleRentalRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const updated = await rentalRequestService.updateRentalStatus(id, status, rejectionReason);
        
        if (!updated) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Request not found" });
        }

        res.status(STATUS_CODES.OK).json({ 
            success: true, 
            message: `Rental request ${status.toLowerCase()} successfully.` 
        });
    } catch (error) {
        next(error);
    }
};
