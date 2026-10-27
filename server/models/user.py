from config import bcrypt, db
from sqlalchemy.ext.hybrid import hybrid_property


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True)
    _password_hash = db.Column("password_hash", db.String)

    # budgets relationship
    budgets = db.relationship('Budget', back_populates='user', cascade='all, delete-orphan')

    # password property: getter raises AttributeError
    @hybrid_property
    def password(self):
        raise AttributeError('Password hash cannot be viewed')

    # password setter: stores the hash
    @password.setter
    def password(self, password):
        password_hash = bcrypt.generate_password_hash(password.encode('utf-8'))
        self._password_hash = password_hash.decode('utf-8')

    # authenticate(password)
    def authenticate(self, password):
        return bcrypt.check_password_hash(
            self._password_hash, password.encode('utf-8')
        )