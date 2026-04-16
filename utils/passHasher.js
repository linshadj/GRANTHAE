import bcrypt from "bcrypt";

export const hashPass = async (password) => {
  const saltRounds = 10;
  const hashedPass = await bcrypt.hash(password, saltRounds);
  return hashedPass;
};

export const compareHashedPass = async (plainPass, hashedPass) => {
    const isPassMatching = bcrypt.compare(plainPass, hashedPass, (err) => {
        if (err) console.log('error in comparing pass: ', err.message);
    })

    return isPassMatching
};
