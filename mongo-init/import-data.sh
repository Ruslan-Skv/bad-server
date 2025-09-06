# Ждем пока MongoDB запустится
echo "Waiting for MongoDB to start..."
sleep 10

# Импортируем пользователей
echo "Importing users..."
mongoimport --uri="mongodb://root:example@localhost:27017/weblarek?authSource=admin" \
  --collection=users \
  --file=/tmp/weblarek.users.json \
  --jsonArray

# Импортируем продукты
echo "Importing products..."
mongoimport --uri="mongodb://root:example@localhost:27017/weblarek?authSource=admin" \
  --collection=products \
  --file=/tmp/weblarek.products.json \
  --jsonArray

echo "Data import completed!"