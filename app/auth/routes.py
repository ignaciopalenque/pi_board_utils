from flask import (
    Blueprint,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

from flask_login import (
    current_user,
    login_required,
    login_user,
    logout_user,
)

from ..extensions import db
from ..models import User


auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/", methods=["GET"])
def main():
    return redirect(url_for("auth.login"))



@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        user = User.query.filter_by(
            username=username
        ).first()

        if user and user.check_password(password):
            if not user.active:
                flash("Usuario desactivado.", "danger")
                return render_template("login.html")

            login_user(user)
            return redirect(url_for("dashboard.index"))

        flash("Usuario o contraseña incorrectos.", "danger")

    return render_template("login.html")



@auth_bp.route("/changePassword", methods=["GET", "POST"])
@login_required
def changePassword():

    if request.method == "POST":

        oldPassword = request.form.get("old_password","")
        password = request.form.get("new_password", "")
        confirmPassword = request.form.get("confirm_password","")

        if password != confirmPassword:
            print("las contraseñas no coinciden")
            flash("Las nuevas contraseñas no coinciden.", "danger")
            return render_template("changePassword.html")

        user = User.query.filter_by(
            username="admin"
        ).first()

        if user :
            if not user.active:
                flash("Usuario desactivado.", "danger")
                return render_template("login.html")
            if not user.check_password(oldPassword):
                flash("El valor de la contraseña actual es incorrecto.", "danger")
                return render_template("changePassword.html")
        print(password)
        user.set_password(password)
        db.session.commit()

        flash("Contraseña cambiada.", "success")

        return redirect(url_for("dashboard.index"))

    return render_template("changePassword.html")




@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))
