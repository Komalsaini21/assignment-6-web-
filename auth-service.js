const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  userName: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  loginHistory: [{
    dateTime: {
      type: Date,
    },
    userAgent: {
      type: String,
    },
  }],
});

let User; 

function initialize() {
  return new Promise((resolve, reject) => {
    const db = mongoose.createConnection("mongodb+srv://komalsaini2124:<password>@cluster0.qqpk9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
    
    db.on("error", (err) => {
      reject(err);
    });

    db.once("open", () => {
      User = db.model("users", userSchema); 
      resolve();
    });
  });
}

function registerUser(userData) {
  return new Promise((resolve, reject) => {
    if (userData.password !== userData.password2) {
      return reject("Passwords do not match");
    }

    bcrypt.hash(userData.password, 10)
      .then((hash) => {
        const newUser = new User({
          userName: userData.userName,
          password: hash,
          email: userData.email,
          loginHistory: userData.userAgent && userData.userAgent !== "Unknown"
            ? [{
                dateTime: new Date(),
                userAgent: userData.userAgent,
              }]
            : [],
        });

        newUser.save()
          .then(() => resolve())
          .catch((err) => {
            if (err.code === 11000) {
              reject("User Name already taken");
            } else {
              reject(`There was an error creating the user: ${err}`);
            }
          });
      })
      .catch((err) => reject(`There was an error encrypting the password: ${err}`));
  });
}

function checkUser(userData) {
  return new Promise((resolve, reject) => {
    User.findOne({ userName: userData.userName })
      .then((user) => {
        if (!user) {
          return reject(`Unable to find user: ${userData.userName}`);
        }

        bcrypt.compare(userData.password, user.password)
          .then((result) => {
            if (!result) {
              return reject(`Incorrect Password for user: ${userData.userName}`);
            }

            if (user.loginHistory.length === 8) {
              user.loginHistory.pop();
            }

            if (userData.userAgent && userData.userAgent !== "Unknown") {
              user.loginHistory.unshift({
                dateTime: new Date(),
                userAgent: userData.userAgent,
              });
            }

            User.updateOne(
              { userName: user.userName },
              { $set: { loginHistory: user.loginHistory } }
            )
              .then(() => resolve(user))
              .catch((err) => reject(`There was an error updating the user history: ${err}`));
          })
          .catch((err) => reject(`There was an error verifying the password: ${err}`));
      })
      .catch((err) => reject(`Unable to find user: ${userData.userName} - ${err}`));
  });
}

module.exports = {
  initialize,
  registerUser,
  checkUser,
};
