const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config(); // Load biến môi trường từ file .env

const app = express();
const port = 3000;

// Middleware để đọc dữ liệu form
app.use(express.urlencoded({ extended: true }));

// Cấu hình view engine
app.use(express.static('./views'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Cấu hình AWS DynamoDB bằng biến môi trường
const config = new AWS.Config({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
AWS.config = config;

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'TinTable';
const upload = multer();

// Route trang chủ: hiển thị dữ liệu từ DynamoDB
app.get('/', (req, res) => {
  const params = {
    TableName: tableName,
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.error("LỖI LẤY DỮ LIỆU:", err);
      res.send('Internal Server Error');
    } else {
      res.render('index', { sanPhams: data.Items });
    }
  });
});

// Route thêm sản phẩm mới
app.post('/add', upload.fields([]), (req, res) => {
  const { ma_sp, ten_sp, so_luong } = req.body;

  const params = {
    TableName: tableName,
    Item: {
      ma_sp: Number(ma_sp),
      ten_sp: ten_sp,
      so_luong: Number(so_luong)
    }
  };

  console.log("GỬI DỮ LIỆU:", params);

  docClient.put(params, (err, data) => {
    if (err) {
      console.error("LỖI GHI DỮ LIỆU:", err);
      return res.send('Internal Server Error');
    } else {
      return res.redirect('/');
    }
  });
});

// Route xóa sản phẩm
app.post('/delete', upload.none(), (req, res) => {
  let { ma_sp } = req.body;

  if (!ma_sp) {
    return res.redirect('/');
  }

  if (!Array.isArray(ma_sp)) {
    ma_sp = [ma_sp];
  }

  function deleteNext(index) {
    if (index >= ma_sp.length) {
      return res.redirect('/');
    }

    const params = {
      TableName: tableName,
      Key: {
        ma_sp: Number(ma_sp[index])
      }
    };

    docClient.delete(params, (err, data) => {
      if (err) {
        console.error("LỖI XÓA:", err);
        return res.send('Lỗi khi xoá sản phẩm');
      } else {
        deleteNext(index + 1);
      }
    });
  }

  deleteNext(0);
});

// Khởi chạy server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
