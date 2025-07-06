/**
 * Standard API response format
 */
class ApiResponse {
  constructor(success, message, data = null, pagination = null) {
    this.success = success;
    this.message = message;
    
    if (data !== null) {
      this.data = data;
    }
    
    if (pagination !== null) {
      this.pagination = pagination;
    }
  }

  static success(data = null, message = 'Operation successful', pagination = null) {
    return new ApiResponse(true, message, data, pagination);
  }

  static error(message = 'An error occurred', data = null) {
    return new ApiResponse(false, message, data);
  }
}

module.exports = ApiResponse;