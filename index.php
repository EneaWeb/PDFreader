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
    $dbh = new PDO('mysql:host=localhost;dbname=pdf', 'pdfuser', 'CSv82c_sih5gcsFF');
    foreach($dbh->query('SELECT * from pdfs WHERE id_rivista = $id_rivista AND num_rivista = $num_rivista') as $row) {
        print_r($row);
    }
    $dbh = null;
} catch (PDOException $e) {
   print "Error!: " . $e->getMessage() . "<br/>";
   die();
}