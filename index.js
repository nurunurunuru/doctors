const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fileUpload = require("express-fileupload")
require('dotenv').config()
const cors = require('cors')

const app = express()
const port =process.env.PORT || 7001

//middleware
app.use(cors())
app.use(express.json())
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DATABASE_USER}:${process.env.DATABASE_PASS}@cluster0.sgghh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function bootstrap() {
  try {
    
    await client.connect();
    console.log("Connected to MongoDB");
    
    const database = client.db("doctorsPortal");
    const appointmentOptionsCollections = database.collection("appointmentOptions")
    const usersCollection = database.collection("Users")
    const bookingCollection = database.collection("Bookings")
    const doctorsCollection = database.collection("Doctors")
    const paymentCollection = database.collection("Payments")

    //appointmentOptions get
    app.get('/appointmentOptions',async(req,res)=>{
      //get date
        const date = req.query.date
        //find by query
        const query = {};
        const options = await appointmentOptionsCollections.find(query).toArray();
        
        //get booking of the provided date by frontend
        const bookingQuery = {appointmentDate: date }
        const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
        
        options.forEach(option => {
        const optionBooked = alreadyBooked.filter(book => book.treatment ===option.name )
        const bookedSlot = optionBooked.map(book => book.slot );
        
        const remainingSlots = option.slots.filter(slot => !bookedSlot.includes(slot))
        option.slots = remainingSlots
        })
        res.send(options)
    })

    //Appointment Specialty
   // Appointment Specialty
app.get('/appointmentSpecialty', async (req, res) => {
  const query = {};
  const result = await appointmentOptionsCollections.find(query).project({ name:1, _id:0 }).toArray();
  res.send(result);
});
//payment

app.post('/create-payment-intent',async(req,res)=>{
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount:amount,
        "payment_method_types": [
    "card",
    "link"
  ],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
  });
//payment

app.post('/payments',async(req,res)=>{
  const payment = req.body;
  const result = await paymentCollection.insertOne(payment);
  const id = payment.bookingId
  const filter = {_id:new ObjectId (id)}
  const updatedDoc = {
    $set:{
      paid:true,
      transactionId:payment.transactionId
    }
  }
  const updatedResult = await bookingCollection.updateOne(filter,updatedDoc,);
  res.send(result)
})



    //appointment get
    app.get('/bookings',async(req,res)=>{
        
      const email = req.query.email
      const query = {email:email};
      const bookings = await bookingCollection.find(query).toArray()
      res.send(bookings)
      
    })

    //Anotherone Booking
    app.get('/bookings/:id',async(req,res)=> {
      const id = req.params.id;
      const query ={_id: new ObjectId(id)};
      const booking = await bookingCollection.findOne(query);
      res.send(booking)
    })


    //booking
    app.post('/bookings',async(req,res)=> {
      const booking = req.body;
      console.log(booking);
      
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment
      }

      const alreadyBooked = await bookingCollection.find(query).toArray()
      if(alreadyBooked.length){
        const message = `You have a booking on ${booking.appointmentDate} try another day`
        return res.send({acknowledged:false, message})
      }

      const result = await bookingCollection.insertOne(booking)
      res.send(result)
      
    })


    //users
    app.get('/users', async (req,res) => {
       const query = {};
       const result = await usersCollection.find(query).toArray();
       res.send(result)
    })

    //Is admin or not
    app.get('/users/admin/:email', async (req,res) => {
      const email = req.params.email;
      const query = {email:email}
      const user = await usersCollection.findOne(query);
    res.send({isAdmin:user?.role === "admin"});
      
   })

    app.post('/users',async(req,res)=> {
      const user = req.body;
      console.log("Received user data:", user);
      
      try {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "" });
      }
    });

    //update users
    app.put('/users/admin/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = { _id:new ObjectId(id) }
      const option = { upsert:true }
      const updatedDoc ={
        $set:{
          role: "admin"
        }
      }
      const result = await usersCollection.updateOne(filter,updatedDoc,option);
      res.send(result)  
    })
    
   // New route to remove admin role
    app.put('/users/remove-admin/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = { _id:new ObjectId(id) }
      const option = { upsert:true }
      const updatedDoc ={
        $set:{
          role: "user"
        }
      }
      const result = await usersCollection.updateOne(filter,updatedDoc,option);
      res.send(result)  
    })

    //Delete Users

   // Delete user
app.delete('/users/delete-user/:id', async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };

  try {
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
  } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).send({ message: "Failed to delete user" });
  }
});


//Temporary
//app.get('/price',async(req,res)=>{
  //const filter = {}
  //const option = {upsert:true}
  //const updatedDoc = {
    //$set:{
      //price:90
    //}
  //}
  //const result = await appointmentOptionsCollections.updateMany(filter,updatedDoc,option)
//})

//Doctor get
app.get('/doctors', async (req,res) => {
  const query = {};
  const result = await doctorsCollection.find(query).toArray();
  res.send(result)
})



app.post('/doctors',async(req,res) => {
  const name = req.body.name;
  const email = req.body.email;
  const specialty = req.body.specialty;
  const pic = req.files.image; 
  const picData = pic.data;
  const encodedPic = picData.toString('base64');
  const imageBuffer = Buffer.from(encodedPic, 'base64')
  const doctor={
    name,
    email,
    specialty,
    image: imageBuffer
  }
 const result = await doctorsCollection.insertOne(doctor)
 res.send(result)
  
})

//Delete doctors
app.delete('/doctors/:id', async (req,res) => {
  const id = req.params.id;
  const filter = {_id: new ObjectId(id) }
  const result = await doctorsCollection.deleteOne(filter)
  res.send(result)
})


  } finally {
   
    //await client.close();
  }
}
bootstrap().catch(console.dir);

app.get('/', (req, res) => {
  res.send('doctorsPortal is Running')
})

app.listen(port, () => {
  console.log(`My final project run on port ${port}`)
})