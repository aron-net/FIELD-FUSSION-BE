const errorHandler = (error, req, res, next) => {
  console.error('Unhandled API error:', error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
};

module.exports = errorHandler;
