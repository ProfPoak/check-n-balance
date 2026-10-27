from config import bcrypt, db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, unique=True)
    _password_hash = db.Column(db.string)

    # budgets relationship

    # password property: getter raises AttributeError

    # password setter: stores the hash

    # authenticate(password)
