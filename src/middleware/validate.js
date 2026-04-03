function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const val = req.body[field];
      if (rules.required && (val === undefined || val === null || val === ""))
        errors.push(`${field} is required`);
      else if (val !== undefined && val !== null) {
        if (rules.type === "number" && (typeof val !== "number" || isNaN(val)))
          errors.push(`${field} must be a number`);
        if (rules.type === "string" && typeof val !== "string")
          errors.push(`${field} must be a string`);
        if (rules.enum && !rules.enum.includes(val))
          errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
        if (rules.min !== undefined && val < rules.min)
          errors.push(`${field} must be at least ${rules.min}`);
        if (rules.minLength !== undefined && typeof val === "string" && val.length < rules.minLength)
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        if (rules.pattern && !rules.pattern.test(val))
          errors.push(`${field} format is invalid`);
      }
    }
    if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
    next();
  };
}

module.exports = { validate };
