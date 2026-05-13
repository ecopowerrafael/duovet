const bcrypt = require('bcryptjs');

const hash = '$2b$08$4eGD67hVbr6X2pjdoO5vnugkHllCMmg/MZtGwtApI0jfPSohZJQnO';
const password = 'password123';

bcrypt.compare(password, hash).then(v => {
    console.log('Valid:', v);
});
