/**
 * User Controller
 * CRUD operations for user management
 */

const User = require('../models/User');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');
const logger = require('../utils/logger');

// ─── GET /api/users — List Users (admin only) ─────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { role, search, isOnline } = req.query;

    const filter = { isActive: true };
    if (role && User.ROLES.includes(role)) filter.role = role;
    if (isOnline !== undefined) filter.isOnline = isOnline === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return ApiResponse.paginated(
      res,
      users,
      buildPaginationMeta(total, page, limit)
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/users/:id ────────────────────────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user || !user.isActive) return next(ApiError.notFound('User not found'));

    return ApiResponse.success(res, { user });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/users/:id ────────────────────────────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    // Admins can update any user; others can only update themselves
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return next(ApiError.forbidden('You can only update your own profile'));
    }

    // Restrict what can be updated via this endpoint
    const allowed = ['name', 'profileImage', 'storeId'];
    if (req.user.role === 'admin') allowed.push('role', 'isActive');

    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return next(ApiError.badRequest('No valid fields to update'));
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) return next(ApiError.notFound('User not found'));

    logger.info(`User ${user.email} updated by ${req.user.email}`);
    return ApiResponse.success(res, { user }, 'User updated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/users/:id (soft delete, admin only) ─────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) return next(ApiError.notFound('User not found'));

    logger.info(`User ${user.email} deactivated by admin ${req.user.email}`);
    return ApiResponse.success(res, {}, 'User deactivated successfully');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/users/agents — Available agents ─────────────────────────────────
const getAvailableAgents = async (req, res, next) => {
  try {
    const agents = await User.find({ role: 'agent', isActive: true, isOnline: true })
      .select('name profileImage isOnline activeConversations lastSeen')
      .sort({ activeConversations: 1 }); // least busy first

    return ApiResponse.success(res, { agents });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, getUserById, updateUser, deleteUser, getAvailableAgents };
