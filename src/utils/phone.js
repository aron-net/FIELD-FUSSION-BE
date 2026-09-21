const normalizeUgandaPhone = phoneNumber => {
  if (!phoneNumber) {
    return null;
  }

  let phone = String(phoneNumber).trim();

  phone = phone.replace(/\s+/g, '');

  if (phone.startsWith('+256')) {
    phone = phone.substring(4);
  } else if (phone.startsWith('256')) {
    phone = phone.substring(3);
  }

  if (phone.startsWith('0')) {
    phone = phone.substring(1);
  }

  if (!/^7\d{8}$/.test(phone)) {
    return null;
  }

  return `+256${phone}`;
};

module.exports = {
  normalizeUgandaPhone,
};
