<?php
try {
    $dbh = new PDO('mysql:host=46.37.12.19;dbname=admin_spreanewdb', 'admin_shopnew', 'nGY96@l8');
    foreach($dbh->query('SELECT * from FOO') as $row) {
        print_r($row);
    }
    $dbh = null;
} catch (PDOException $e) {
    print "Error!: " . $e->getMessage() . "<br/>";
    die();
}

$id_rivista = $_GET['id_rivista'];
$num_rivista = $_GET['num_rivista'];


if ($_GET['id_rivsta'])