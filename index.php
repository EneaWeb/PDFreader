<?php
$anagrafica_utente = isset($_GET['a']) ? $_GET['a'] : '';
$id_rivista = isset($_GET['i']) ? $_GET['i'] : '';
$num_rivista = isset($_GET['n']) ? $_GET['n'] : '';

## 
## ERROR 0009
##
if ($id_rivista == '' || $num_rivista == '') {
	echo 'Errore 0009. Valori inesistenti.';
	exit();
}
##

try {
    $dbh = new PDO('mysql:host=localhost;dbname=pdf', 'root', 'Diagonalli872|');
    $q = $dbh->query('TRUNCATE TABLE pdfs');
    //$q = $dbh->query('INSERT INTO pdfs (id_rivista, num_rivista, name) VALUES ("1344", "5", "HipHopRap_iPad(1).pdf"), ("859", "12", "Speciale_LIGHTROOM.pdf")');
    foreach($dbh->query('SELECT * from pdfs ') as $row) {
        print_r($row);
    }
    $dbh = null;
} catch (PDOException $e) {
   print "Error!: " . $e->getMessage() . "<br/>";
   die();
}