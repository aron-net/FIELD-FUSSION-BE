const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Request body contains invalid JSON.',
    });
  }

  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body is too large.',
    });
  }

  console.error('Unhandled API error:', error);

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
};

module.exports = errorHandler;
