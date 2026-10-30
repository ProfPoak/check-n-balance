from config import bcrypt, db
from email_validator import EmailNotValidError, validate_email
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import validates


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False)
    _password_hash = db.Column("password_hash", db.String, nullable=False)

    # budgets relationship
    budgets = db.relationship('Budget', back_populates='user', cascade='all, delete-orphan')

    @validates('email')
    def validate_email_address(self, key, value):
        value = (value or '').strip()
        if not value:
            raise ValueError('Email is required')
        try:
            result = validate_email(value, check_deliverability=False)
        except EmailNotValidError as e:
            raise ValueError(str(e))
        return result.normalized.lower()

    @hybrid_property
    def password(self):
        raise AttributeError('Password hash cannot be viewed')

    # password setter: checks length before hashing (bcrypt caps at 72 bytes)
    @password.setter
    def password(self, password):
        if not password or len(password) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(password.encode('utf-8')) > 72:
            raise ValueError('Password cannot exceed 72 characters')
        password_hash = bcrypt.generate_password_hash(password.encode('utf-8'))
        self._password_hash = password_hash.decode('utf-8')

    # authenticate(password)
    def authenticate(self, password):
        return bcrypt.check_password_hash(
            self._password_hash, password.encode('utf-8')
        )
