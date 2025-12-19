const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
// Kết nối MongoDB với username là MSSV, password là MSSV, dbname là it4409
mongoose
  .connect(
    "mongodb+srv://20224875:20224875@it4409.n6cgtgk.mongodb.net/it4409?retryWrites=true&w=majority"
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err));
// TODO: Tạo Schema
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tên không được để trống"],

    minlength: [2, "Tên phải có ít nhất 2 ký tự"],
  },
  age: {
    type: Number,
    required: [true, "Tuổi không được để trống"],
    min: [0, "Tuổi phải >= 0"],
  },
  email: {
    type: String,
    required: [true, "Email không được để trống"],
    match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    unique: true, 
  },
  address: {
    type: String,
  },
});
const User = mongoose.model("User", UserSchema);

app.get("/api/users", async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";

    if (page < 1) page = 1;
    if (limit < 1) limit = 5;
    if (limit > 100) limit = 100; 

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      page,
      limit,
      total,
      totalPages,
      data: users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const name = req.body.name ? req.body.name.trim() : "";
    const age = parseInt(req.body.age);
    const email = req.body.email ? req.body.email.trim() : "";
    const address = req.body.address ? req.body.address.trim() : "";

    if (isNaN(age) || age < 0) {
      return res.status(400).json({ error: "Tuổi phải là số nguyên >= 0" });
    }

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({ 
        error: `Email "${email}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.` 
      });
    }

    const newUser = await User.create({ name, age, email, address });
    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ error: `Validation failed: ${errors.join(', ')}` });
    } else if (err.code === 11000) {
      const emailValue = err.keyValue?.email || req.body.email || "email này";
      res.status(400).json({ 
        error: `Email "${emailValue}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.` 
      });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const updateData = {};
    
    if (req.body.name !== undefined) {
      updateData.name = req.body.name.trim();
    }
    if (req.body.age !== undefined) {
      const age = parseInt(req.body.age);
      if (isNaN(age) || age < 0) {
        return res.status(400).json({ error: "Tuổi phải là số nguyên >= 0" });
      }
      updateData.age = age;
    }
    if (req.body.email !== undefined) {
      const newEmail = req.body.email.trim();
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ 
          error: `Email "${newEmail}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.` 
        });
      }
      updateData.email = newEmail;
    }
    if (req.body.address !== undefined) {
      updateData.address = req.body.address.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    
    res.json({
      message: "Cập nhật người dùng thành công",
      data: updatedUser,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      res.status(400).json({ error: `Validation failed: ${errors.join(', ')}` });
    } else if (err.name === 'CastError') {
      res.status(404).json({ error: "Không tìm thấy người dùng" });
    } else if (err.code === 11000) {
      const emailValue = err.keyValue?.email || "email này";
      res.status(400).json({ 
        error: `Email "${emailValue}" đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.` 
      });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
