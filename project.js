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


con.connect(function(err) {
	if (err) throw err;
	console.log('Connected to MySQL AnprAccessControl Database');  
	client.on('connect', function() { // When 'connect' event is received, this anonymous callback listener function is called  
		console.log('Connected to CloudMQTT Broker');
		setInterval(mainLoop, 6000);
		
		function mainLoop() {
			console.log("Attempting to Capture Image from Webcam...");
			//Tell the webcam to take a picture and store it in the webcam directory using capture as the name
			exec('fswebcam -r 640x480 --no-banner --quiet /home/pi/Desktop/anprproject/webcam/capture.jpg', 
				function (error, stdout, stderr) {
					if (error !== null) {
						//Log any execution errors
						console.log('Webcam Execution Error: ' + error);
					}
					else if (stderr != ''){
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
									if (plateOutput.results.length == 0){
										console.log('No Reg Plates Found in Image');
									}
									else if (plateOutput.results.length == 1){
										console.log('Original Plate: ' + plateOutput.results[0].plate);
										var actualIrishPlate = plateOutput.results[0].plate.replace(/I/g,'1');
										console.log('1 Reg Plate Found in Image: ' + actualIrishPlate);
										con.query('SELECT COUNT(*) AS MatchingAllowedRegPlateCount FROM AllowedRegPlates WHERE RegPlate = "' + actualIrishPlate + '"', function (err, result) {
											console.log('Checking if Detected Reg Plate is in AllowedRegPlates Table...');
											if (err) throw err;
											if (result[0].MatchingAllowedRegPlateCount == 0) {
												console.log('Vehicle Reg Plate is not in AllowedRegPlates Table');
												client.publish('AnprAccessControl/Alert', actualIrishPlate, function() {    
													console.log('Alert for Unrecognised Reg Plate ' + actualIrishPlate + ' has been Published');
													client.subscribe('AnprAccessControl/Resolution', function() { //Subscribe to 'AnprAccessControl/Resolution' topic and once subscribed this anonymous callback listener fuction is called
													function loopForResolutionMessage() {
															console.log("Waiting for a Resolution Message from Client... ");
															// When a message arrives from the MQTT broker
															client.on('message', function(topic, message, packet) {
																console.log(message);
																if (message == 'Allowed'){
																	console.log('Vehicle with Reg Plate ' + actualIrishPlate + 'has been Granted Access');
																	var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, AccessGranted) VALUES ('" + actualIrishPlate + "', '1')";
																	con.query(sql, function (err, result) {
																		if (err) throw err;
																		console.log("Log Record inserted into RegPlatesLog");
																	});
																	player.play('sounds/welcome.mp3', function(err){
																		if (err) throw err
																		console.log("Playing Welcome Sound");
																	});
																}
																else {
																	console.log('Vehicle with Reg Plate ' + actualIrishPlate + 'has been Denied Access');
																	var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, AccessGranted) VALUES ('" + actualIrishPlate + "', '0')";
																	con.query(sql, function (err, result) {
																		if (err) throw err;
																		console.log("Log Record inserted into RegPlatesLog");
																	});
																}	
															});
													}
													setTimeout(loopForResolutionMessage, 10000);
													});
													
												});
											}
											else {
												console.log('Vehicle Reg Plate is in AllowedRegPlates Table');
												var sql = "INSERT INTO RegPlatesLog (RegPlateDetected, AccessGranted) VALUES ('" + actualIrishPlate + "', '1')";
												con.query(sql, function (err, result) {
													if (err) throw err;
													console.log("Log Record inserted into RegPlatesLog");
												});
												player.play('sounds/welcome.mp3', function(err){
													if (err) throw err
													console.log("Playing Welcome Sound");
												});
											}
										});
									}
									else {
										console.log('Too Many Reg Plates Found in Image');
									}
									console.log('Image Processing Time: ' + plateOutput.processing_time_ms);	
								}
							});
						}	
				});
		}
	});	
});	



	
	
