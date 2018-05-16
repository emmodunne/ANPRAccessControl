var sys = require('sys'),
    exec = require('child_process').exec;
var mysql = require('mysql');
var mqtt = require('mqtt');
var player = require('play-sound')(opts = {})

// Define connection parameters for connecting MySQL Database
var con = mysql.createConnection({
  host: "127.0.0.1",
  user: "PhpUser",
  password: "raspberry",
  database: "AnprAccessControl"
});

// Define options for connecting to MQTT broker
var options = {
  port: 11776,
  clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
  username: "trmyrtew",
  password: "nYvSrE3e0y11",
};

// Connect to MQTT broker
var client  = mqtt.connect('mqtt://m21.cloudmqtt.com', options)

//Global Variables
var seconds = 0;
var currentIrishPlate;
var previousIrishPlate;
var resolutionReceived;

con.connect(function(err) {
	if (err) throw err;
	console.log('Connected to MySQL AnprAccessControl Database');  
	client.on('connect', function() { // When 'connect' event is received, this anonymous callback listener function is called  
		console.log('Connected to CloudMQTT Broker\n');
		mainLoop();
		
		function mainLoop() {
			console.log('Attempting to Capture an Image from Webcam...');
				//Tell the webcam to take a picture and store it in the webcam directory using capture as the name
			exec('fswebcam -r 640x480 --no-banner --quiet /home/pi/Desktop/anprproject/webcam/capture.jpg', 
				function (error, stdout, stderr) {
					if (error !== null) {
						//Log any execution errors
						console.log('Webcam Execution Error: ' + error);
					}
					else if (stderr != '') {
						//Log any standard errors
						console.log('Webcam Standard Error: ' + stderr);	
					}
					else {
						console.log('Image Captured Successfully from Webcam');
						//Parse the captured image with OpenALPR (using country code: eu) and return the results in json format (the -j switch) 
						exec('alpr -j -c eu /home/pi/Desktop/anprproject/webcam/capture.jpg',
							function (error, stdout, stderr) {
								if (error !== null) {
									//Log any execution errors
									console.log('Parse Execution Error: ' + error);
								}
								else if (stderr != ''){
									//Log any standard errors
									console.log('Parse Standard Error: ' + stderr);			
								}
								else {
									//Create a json object based on the standard alpr output
									var plateOutput = JSON.parse(stdout.toString());	
									//Hack #1: Return 1 from plateOutput.results.length
									//plateOutput.results.length = 1;
									if (plateOutput.results.length == 0) {
										console.log('No Reg Plates Found in Image\n');
										mainLoop();
									}
									else if (plateOutput.results.length == 1) {
										//Hack #2: Hardcode currentIrishPlate instead of getting it from JSON blob
										console.log('Original Plate: ' + plateOutput.results[0].plate);
										currentIrishPlate = plateOutput.results[0].plate.replace(/I/g,'1');
										//currentIrishPlate = "141D35066";
										console.log('1 Reg Plate Found in Image: ' + currentIrishPlate);
										if (currentIrishPlate == previousIrishPlate) {
											console.log('Same Reg Plate as previous\n');
											mainLoop();
										}
										else {
											console.log('Checking if Detected Reg Plate is in AllowedRegPlates Table...');
											con.query('SELECT COUNT(*) AS MatchingAllowedRegPlateCount FROM AllowedRegPlates WHERE RegPlate = "' + currentIrishPlate + '"', function (err, result) {
												if (err) throw err;
												if (result[0].MatchingAllowedRegPlateCount == 0) {
													console.log('Vehicle Reg Plate is not in AllowedRegPlates Table');
													client.publish('AnprAccessControl/Alert', currentIrishPlate, function() {    
														console.log('Alert for Unrecognised Reg Plate ' + currentIrishPlate + ' has been Published');
														//Subscribe to 'AnprAccessControl/Resolution' topic and once subscribed this anonymous callback listener fuction is called
														client.subscribe('AnprAccessControl/Resolution', function() {
															resolutionReceived = false;
															seconds = 0;
															console.log('Waiting for a Resolution Message from Client...');			
														});
													});
												}
												else {
													console.log('\nVehicle Reg Plate is in AllowedRegPlates Table');
													var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, Action) VALUES ('" + currentIrishPlate + "', 'Grant')";
													con.query(sql, function (err, result) {
														if (err) throw err;
														console.log('Log Record inserted into RegPlatesLog\n');
														player.play('sounds/AccessGranted.mp3', function(err) {
															if (err) throw err
															console.log("Playing Access Granted Sound");
															previousIrishPlate = currentIrishPlate;
															mainLoop();
														});
													});
												}
											});
										}
									}
									else {
										console.log('Too Many Reg Plates Found in the Captured Image');
									}	
								}
							});
					}	
				});
		}
		
		setInterval(function(){
			seconds++;
			if(seconds == 10 && resolutionReceived == false) {
				client.publish('AnprAccessControl/Resolution', 'None', function() {
					console.log('\nTimeout: Published a None Resolution for ' + currentIrishPlate);
				});
			}
			if(seconds == 10) {
				client.unsubscribe('AnprAccessControl/Resolution', function() {
				});
			}

		}, 1000);
		
		client.on('message', function(topic, message, packet) {
			if (message.toString() == 'Grant') {
				resolutionReceived = true;
				console.log('\nResolution Received from Client: ' + message.toString());
				console.log('Vehicle with Reg Plate ' + currentIrishPlate + ' has been Granted Access');
				var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, Action) VALUES ('" + currentIrishPlate + "', 'Grant')";
				con.query(sql, function (err, result) {
					if (err) throw err;
					console.log("Log Record inserted into RegPlatesLog");
					player.play('sounds/AccessGranted.mp3', function(err){
						if (err) throw err
						console.log("Playing Access Granted Sound\n");
						mainLoop();
					});
				});
				
				
			}
			else if (message.toString() == 'Deny') {
				resolutionReceived = true;
				console.log('\nResolution Received from Client: ' + message.toString());
				console.log('Vehicle with Reg Plate ' + currentIrishPlate + ' has been Denied Access');
				var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, Action) VALUES ('" + currentIrishPlate + "', 'Deny')";
				con.query(sql, function (err, result) {
					if (err) throw err;
					console.log('Log Record inserted into RegPlatesLog');
					player.play('sounds/AccessDenied.mp3', function(err) {
						if (err) throw err
						console.log("Playing Access Denied Sound\n");
						mainLoop();
					});
				});
			}
			else if (message.toString() == 'None') {
				console.log('\nResolution Received from Client: ' + message.toString());
				console.log('Vehicle with Reg Plate ' + currentIrishPlate + ' has been Denied Access');
				var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, Action) VALUES ('" + currentIrishPlate + "', 'None')";
				con.query(sql, function (err, result) {
					if (err) throw err;
					console.log('Log Record inserted into RegPlatesLog');
					player.play('sounds/AccessDenied.mp3', function(err) {
						if (err) throw err
						console.log("Playing Access Denied Sound\n");
						mainLoop();
					});
				});
			}
			previousIrishPlate = currentIrishPlate;
		});

	});	
});
