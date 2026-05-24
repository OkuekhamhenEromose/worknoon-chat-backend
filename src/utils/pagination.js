/**
 * Pagination Utility
 * Provides consistent offset-based pagination across all list endpoints
 */

/**
 * Parse and validate pagination params from query string
 * @param {Object} query - req.query
 * @returns {{ page, limit, skip }}
 */
function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build pagination metadata
 * @param {number} total - total document count
 * @param {number} page
 * @param {number} limit
 */
function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = { getPaginationParams, buildPaginationMeta };
